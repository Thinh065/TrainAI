import io
import json
import unittest
from unittest import mock

from app import consistency, consistency_jobs, link_reader


def _canva_html(pages):
    data = {"page": {"Pm": {"E": {"draft": {"content": {"A": pages}}}}}}
    raw = json.dumps(data, ensure_ascii=False).replace("\\", "\\\\").replace("'", "\\'")
    return f"<html><head><title>Bài nhóm 7</title></head><script>window['bootstrap'] = JSON.parse('{raw}');</script></html>"


class CanvaReaderTests(unittest.TestCase):
    def test_reads_text_boxes_and_table_cells_per_slide(self):
        pages = [
            {"E": [{"a": {"C": {"A": ["Ananas thành lập năm 2010\n", "${pageNumberOnly}"]}}}], "Z": {"A": "TACQ-gtv2Yk"}},
            {"E": [{"b": [{"A": {"A?": "A", "A": "Mức độ"}}, {"A": {"A?": "A", "A": "Cao"}}]}]},
            {"E": [{"b": [{"A": "M0 0L10 10Z"}]}]},
        ]
        response = mock.Mock(text=_canva_html(pages))
        with mock.patch.object(link_reader, "_download", return_value=response):
            doc = link_reader.read_link("https://www.canva.com/design/DAHX/abc/edit?utm_source=x")

        self.assertEqual(doc["title"], "Bài nhóm 7")
        self.assertEqual(doc["total_sections"], 3)
        self.assertEqual(
            doc["sections"],
            [
                {"label": "Slide 1", "text": "Ananas thành lập năm 2010"},
                {"label": "Slide 2", "text": "Mức độ\nCao"},
            ],
        )

    def test_private_hosts_are_refused(self):
        for url in ("http://127.0.0.1:8501/api/health", "http://localhost/x.docx", "file:///etc/passwd"):
            with self.assertRaises(link_reader.LinkReadError):
                link_reader._check_public_host(url)


class FileReaderTests(unittest.TestCase):
    def test_pptx_slides_keep_their_numbers(self):
        from pptx import Presentation
        from pptx.util import Inches

        deck = Presentation()
        for text in ("Giá bán 500.000đ", "", "Giá bán 650.000đ"):
            slide = deck.slides.add_slide(deck.slide_layouts[6])
            if text:
                slide.shapes.add_textbox(0, 0, Inches(4), Inches(1)).text_frame.text = text
        buffer = io.BytesIO()
        deck.save(buffer)

        sections = link_reader._read_file_bytes(buffer.getvalue(), "bai.pptx")
        self.assertEqual([s["label"] for s in sections], ["Slide 1", "Slide 3"])

    def test_docx_is_split_by_headings(self):
        from docx import Document

        doc = Document()
        doc.add_heading("Phân tích", level=1)
        doc.add_paragraph("Rủi ro ở mức thấp.")
        doc.add_heading("Kết luận", level=1)
        doc.add_paragraph("Rủi ro ở mức cao.")
        buffer = io.BytesIO()
        doc.save(buffer)

        sections = link_reader._read_file_bytes(buffer.getvalue(), "bai.docx")
        self.assertEqual([s["label"] for s in sections], ["Phân tích", "Kết luận"])


class ConsistencyTests(unittest.TestCase):
    document = {
        "title": "Bài test",
        "source": "Canva",
        "total_sections": 2,
        "sections": [
            {"label": "Slide 3", "text": "Quyền lực của khách hàng: mức độ Cao."},
            {"label": "Slide 12", "text": "Kết luận: quyền lực khách hàng ở mức Thấp."},
        ],
    }

    def _run(self, model_output):
        with mock.patch.object(consistency, "ask_chatbot_json", return_value=model_output):
            return consistency.check_consistency(self.document)

    def test_keeps_issues_with_real_quotes_and_scores_them(self):
        result = self._run(
            {
                "summary": "Có một chỗ vênh.",
                "issues": [
                    {
                        "severity": "high",
                        "category": "Mâu thuẫn nhận định",
                        "title": "Quyền lực khách hàng lúc Cao lúc Thấp",
                        "explanation": "Hai slide đánh giá ngược nhau.",
                        "locations": [
                            {"label": "Slide 3", "quote": "Quyền lực của khách hàng: mức độ Cao."},
                            {"label": "Slide 12", "quote": "quyền lực khách hàng ở mức Thấp"},
                        ],
                        "suggestion": "Chọn một mức.",
                    }
                ],
            }
        )
        self.assertEqual(len(result["issues"]), 1)
        self.assertEqual(len(result["issues"][0]["locations"]), 2)
        self.assertEqual(result["score"], 85)

    def test_drops_issues_whose_quotes_are_not_in_the_document(self):
        result = self._run(
            {
                "issues": [
                    {
                        "severity": "high",
                        "title": "Bịa",
                        "locations": [
                            {"label": "Slide 3", "quote": "Doanh thu năm 2024 đạt 900 tỷ đồng"},
                            {"label": "Slide 99", "quote": "Quyền lực của khách hàng"},
                        ],
                    }
                ]
            }
        )
        self.assertEqual(result["issues"], [])
        self.assertEqual(result["score"], 100)


class JobTests(unittest.TestCase):
    def _wait(self, job_id, owner="u1"):
        import time

        for _ in range(200):
            job = consistency_jobs.get_job(job_id, owner)
            if job["status"] != "running":
                return job
            time.sleep(0.02)
        self.fail("job did not finish")

    def test_same_content_is_checked_once_and_jobs_are_private(self):
        doc = {"title": "Bài", "sections": [{"label": "Slide 1", "text": f"Nội dung {id(self)}"}]}
        result = {"score": 100, "issues": [], "summary": "", "title": "Bài"}
        with mock.patch.object(consistency_jobs, "read_link", return_value=doc), \
                mock.patch.object(consistency_jobs, "check_consistency", return_value=result) as check:
            first = self._wait(consistency_jobs.start_job("https://x/a", owner="u1"))
            second = self._wait(consistency_jobs.start_job("https://x/a", owner="u1"))
            other = consistency_jobs.start_job("https://x/a", owner="u1")

        self.assertEqual(first["status"], "done")
        self.assertEqual(second["result"]["url"], "https://x/a")
        check.assert_called_once()
        self.assertIsNone(consistency_jobs.get_job(other, owner="someone-else"))

    def test_unreadable_link_reports_the_reason(self):
        with mock.patch.object(consistency_jobs, "read_link", side_effect=link_reader.LinkReadError("Link chưa để public")):
            job = self._wait(consistency_jobs.start_job("https://x/b", owner="u1"))
        self.assertEqual(job, {"status": "error", "stage": "reading", "error": "Link chưa để public"})


if __name__ == "__main__":
    unittest.main()
