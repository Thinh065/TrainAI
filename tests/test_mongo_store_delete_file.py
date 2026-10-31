import unittest

from app import mongo_store


class DummyDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


class DummyFilesCollection:
    def __init__(self):
        self.deleted = None

    def delete_one(self, query):
        self.deleted = query
        return DummyDeleteResult(1)


class DummyDB:
    def __init__(self):
        self.files = DummyFilesCollection()


class DeleteFileRecordTests(unittest.TestCase):
    def test_delete_file_record_removes_matching_file(self):
        dummy_db = DummyDB()
        original_get_db = mongo_store.get_db
        mongo_store.get_db = lambda: dummy_db
        try:
            deleted = mongo_store.delete_file_record("user-1", "conversation-1", "file-1")
            self.assertTrue(deleted)
            self.assertEqual(
                dummy_db.files.deleted,
                {
                    "file_id": "file-1",
                    "conversation_id": "conversation-1",
                    "user_id": "user-1",
                },
            )
        finally:
            mongo_store.get_db = original_get_db


if __name__ == "__main__":
    unittest.main()
