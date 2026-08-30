import gzip
import http.client
import tempfile
import threading
import unittest
from pathlib import Path

from prototype.api_server import build_server


class ApiGzipTest(unittest.TestCase):
    def test_json_responses_use_gzip_when_client_accepts_it(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            server = build_server("127.0.0.1", 0, Path(tmpdir))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port)
                connection.request(
                    "GET",
                    "/api/v1/health",
                    headers={"Accept-Encoding": "gzip"},
                )
                response = connection.getresponse()
                body = response.read()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

            self.assertEqual(response.status, 200)
            self.assertEqual(response.getheader("Content-Encoding"), "gzip")
            self.assertIn(b'"status"', gzip.decompress(body))


if __name__ == "__main__":
    unittest.main()
