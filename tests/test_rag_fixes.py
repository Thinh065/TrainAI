import io
import os
import tempfile
import unittest
import uuid
from unittest import mock

import chromadb

from app import chroma_store, rag_service, server


def _meta(conversation_id, file_id="file-1", page=1, chunk=0):
    return {
        "user_id": "user-1",
        "conversation_id": conversation_id,
        "file_id": file_id,
        "file_name": "bieu_phi.pdf",
        "page_number": page,
        "chunk_index": chunk,
    }


class ChromaStoreTests(unittest.TestCase):
    def setUp(self):
        client = chromadb.EphemeralClient()
        self.collection = client.get_or_create_collection(f"test-{uuid.uuid4().hex}")
        patcher = mock.patch.object(chroma_store, "get_collection", return_value=self.collection)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_same_pdf_in_two_conversations_keeps_both(self):
        chroma_store.add_documents(["a"], [[0.1, 0.2]], [_meta("conv-a")])
        chroma_store.add_documents(["a"], [[0.1, 0.2]], [_meta("conv-b")])
        self.assertEqual(self.collection.count(), 2)

    def test_search_does_not_leak_other_conversations(self):
        chroma_store.add_documents(["a"], [[0.1, 0.2]], [_meta("conv-a")])
        results = chroma_store.search_similar_documents([0.1, 0.2], user_id="user-1", conversation_id="conv-b", top_k=4)
        self.assertEqual(results, [])

    def test_delete_by_file_and_by_conversation(self):
        chroma_store.add_documents(
            ["a", "b", "c"],
            [[0.1, 0.2]] * 3,
            [_meta("conv-a", "f1"), _meta("conv-a", "f2"), _meta("conv-b", "f1")],
        )
        self.assertEqual(chroma_store.delete_documents_by_file_id("user-1", "conv-a", "f1"), 1)
        self.assertEqual(chroma_store.delete_documents_by_conversation("user-1", "conv-a"), 1)
        self.assertEqual(self.collection.count(), 1)


class SourcesTests(unittest.TestCase):
    def test_unique_sources_one_per_file_page(self):
        retrieved = [
            {"document": "x", "metadata": _meta("c", "f1", page=3)},
            {"document": "y", "metadata": _meta("c", "f1", page=3, chunk=1)},
            {"document": "z", "metadata": _meta("c", "f1", page=5)},
            {"document": "", "metadata": _meta("c", "f2", page=1)},
        ]
        self.assertEqual(
            rag_service._unique_sources(retrieved),
            [
                {"file_id": "f1", "file_name": "bieu_phi.pdf", "page_number": 3},
                {"file_id": "f1", "file_name": "bieu_phi.pdf", "page_number": 5},
            ],
        )


class ReindexTests(unittest.TestCase):
    def test_recorded_file_without_chunks_is_indexed_again(self):
        with tempfile.TemporaryDirectory() as tmp:
            kept = os.path.join(tmp, "kept.pdf")
            fresh = os.path.join(tmp, "fresh.pdf")
            for path in (kept, fresh):
                open(path, "wb").close()
            record = {"file_path": kept}
            pages = [{"page_number": 1, "text": "Hoc phi 2.450.000 dong."}]
            with mock.patch.object(rag_service, "get_file_by_id", return_value=record),                     mock.patch.object(rag_service, "count_documents_for_file", return_value=0),                     mock.patch.object(rag_service, "extract_text_from_pdf", return_value=pages) as extract,                     mock.patch.object(rag_service, "create_embeddings", return_value=mock.Mock(tolist=lambda: [[0.1]])),                     mock.patch.object(rag_service, "add_chroma_documents") as add_docs,                     mock.patch.object(rag_service, "add_file_record") as add_record:
                result = rag_service.ingest_pdf("u", "c", fresh, "a.pdf", file_id="f1")

            self.assertEqual(result["chunks_indexed"], 1)
            extract.assert_called_once_with(kept)
            add_docs.assert_called_once()
            add_record.assert_not_called()
            self.assertFalse(os.path.exists(fresh))
            self.assertTrue(os.path.exists(kept))


class UploadRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        patcher = mock.patch.object(server, "UPLOAD_DIR", tmp.name)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _upload(self, user_id, conversation_id="conv1"):
        return self.client.post(
            f"/api/conversations/{conversation_id}/files",
            data={"user_id": user_id, "file": (io.BytesIO(b"%PDF-1.4"), "a.pdf")},
            content_type="multipart/form-data",
        )

    def test_rejects_path_traversal_in_user_id(self):
        response = self._upload("../../etc")
        self.assertEqual(response.status_code, 400)

    def test_unreadable_pdf_is_422_and_file_removed(self):
        saved = []

        def fake_ingest(**kwargs):
            saved.append(kwargs["pdf_path"])
            raise ValueError("PDF does not contain extractable text")

        with mock.patch.object(server, "ingest_pdf", side_effect=fake_ingest):
            response = self._upload("user1")
        self.assertEqual(response.status_code, 422)
        self.assertFalse(any(os.path.exists(p) for p in saved))

    def test_chat_model_failure_is_502(self):
        with mock.patch.object(server, "answer_question", side_effect=server.ChatbotError("down")):
            response = self.client.post("/api/chat", json={"user_id": "u", "conversation_id": "c", "message": "hi"})
        self.assertEqual(response.status_code, 502)


if __name__ == "__main__":
    unittest.main()
