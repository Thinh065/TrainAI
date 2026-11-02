import unittest
from unittest import mock

from app import keyword_search, rag_service
from app.pdf_processor import chunk_text


class ChunkTextTests(unittest.TestCase):
    def test_chunks_never_start_or_end_mid_word(self):
        words = [f"chữ{i}" for i in range(400)]
        text = "\n".join(" ".join(words[i:i + 7]) for i in range(0, 400, 7))
        chunks = chunk_text(text, chunk_size=200, chunk_overlap=50)

        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 200)
            for word in chunk.split():
                self.assertIn(word, words)


class KeywordSearchTests(unittest.TestCase):
    def test_exact_phrase_ranks_first(self):
        docs = [
            "Hà Nội có nhiều hồ nước và công viên.",
            "Năm 1010, Lý Thái Tổ quyết định dời đô về Đại La.",
            "Đại học ở Hà Nội đào tạo nhiều ngành.",
        ]
        self.assertEqual(keyword_search.bm25_rank("Lý Thái Tổ dời đô về Đại La năm nào?", docs)[0], 1)

    def test_question_words_alone_match_nothing(self):
        self.assertEqual(keyword_search.bm25_rank("là bao nhiêu?", ["Giá là bao nhiêu tiền"]), [])

    def test_fusion_rewards_agreement(self):
        fused = keyword_search.reciprocal_rank_fusion([["a", "b", "c"], ["b", "d"]])
        self.assertEqual(fused[0], "b")
        self.assertEqual(set(fused), {"a", "b", "c", "d"})


def _passage(i, text):
    return {"document": text, "metadata": {"file_id": "f", "page_number": i, "chunk_index": 0}}


class RetrievePassagesTests(unittest.TestCase):
    def test_keyword_hit_reaches_context_when_vectors_miss_it(self):
        passages = [_passage(i, f"Đoạn mô tả chung số {i} về thành phố.") for i in range(30)]
        passages.append(_passage(99, "Nhiệt độ trung bình cả năm là 23,6 °C."))
        by_meaning = passages[:20]

        with mock.patch.object(rag_service, "create_query_embedding", return_value=mock.Mock(tolist=lambda: [0.1])), \
                mock.patch.object(rag_service, "search_chroma_documents", return_value=by_meaning), \
                mock.patch.object(rag_service, "get_conversation_documents", return_value=passages):
            result = rag_service.retrieve_passages("u", "c", "Nhiệt độ trung bình cả năm là bao nhiêu?")

        self.assertEqual(len(result), rag_service.CONTEXT_PASSAGES)
        self.assertIn(99, [p["metadata"]["page_number"] for p in result])


class AnswerHistoryTests(unittest.TestCase):
    def _answer(self, history):
        with mock.patch.object(rag_service, "retrieve_passages", return_value=[]), \
                mock.patch.object(rag_service, "get_messages", return_value=[{"role": "user", "content": "cũ"}]) as stored, \
                mock.patch.object(rag_service, "ask_chatbot", return_value="Trả lời") as ask, \
                mock.patch.object(rag_service, "add_message") as add:
            rag_service.answer_question("u", "c", "Câu hỏi?", history=history)
        return stored, ask.call_args.args[0], add

    def test_history_from_web_is_used_and_not_stored_again(self):
        stored, prompt, add = self._answer([{"role": "assistant", "content": "Độ nhất quán: 53/100"}])
        stored.assert_not_called()
        add.assert_not_called()
        self.assertIn("Độ nhất quán: 53/100", prompt)

    def test_without_history_python_keeps_its_own(self):
        stored, prompt, add = self._answer(None)
        stored.assert_called_once()
        self.assertEqual(add.call_count, 2)
        self.assertIn("user: cũ", prompt)


if __name__ == "__main__":
    unittest.main()
