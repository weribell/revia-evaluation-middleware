from __future__ import annotations

import io
import json
import unittest
from email.message import Message
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from prototype.api_server import OPENAI_MAX_ATTEMPTS, call_openai_response


OK_PAYLOAD = {
    "id": "resp_1",
    "model": "gpt-5.4-mini",
    "output_text": "Hallo, hier ist die Antwort.",
    "usage": {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
}


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *exc_info) -> bool:
        return False

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


def _http_error(code: int, retry_after: str | None = None) -> HTTPError:
    headers = Message()
    if retry_after is not None:
        headers["Retry-After"] = retry_after
    return HTTPError(
        url="https://api.openai.com/v1/responses",
        code=code,
        msg="error",
        hdrs=headers,
        fp=io.BytesIO(b'{"error": "boom"}'),
    )


def _call() -> dict:
    return call_openai_response(
        api_key="test-key",
        input_text="Citizen question",
        model_name="gpt-5.4-mini",
        prompt_text="Answer politely.",
    )


class OpenAIRetryTest(unittest.TestCase):
    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_retries_on_429_then_succeeds(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = [_http_error(429), _FakeResponse(OK_PAYLOAD)]

        result = _call()

        self.assertEqual(result["text"], "Hallo, hier ist die Antwort.")
        self.assertEqual(mock_urlopen.call_count, 2)
        self.assertEqual(mock_sleep.call_count, 1)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_respects_retry_after_header(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = [_http_error(429, retry_after="2"), _FakeResponse(OK_PAYLOAD)]

        _call()

        self.assertTrue(
            any(call.args and call.args[0] >= 2.0 for call in mock_sleep.call_args_list),
            f"expected a sleep of at least 2s, got {mock_sleep.call_args_list}",
        )

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_does_not_retry_on_400(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = _http_error(400)

        with self.assertRaises(RuntimeError):
            _call()

        self.assertEqual(mock_urlopen.call_count, 1)
        self.assertEqual(mock_sleep.call_count, 0)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_exhausts_attempts_on_network_error(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = URLError("connection reset")

        with self.assertRaises(RuntimeError):
            _call()

        self.assertEqual(mock_urlopen.call_count, OPENAI_MAX_ATTEMPTS)
        self.assertEqual(mock_sleep.call_count, OPENAI_MAX_ATTEMPTS - 1)


if __name__ == "__main__":
    unittest.main()
