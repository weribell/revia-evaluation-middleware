from __future__ import annotations

try:
    from prototype.api_common import *
    from prototype.api_store import PrototypeStore
except ModuleNotFoundError:
    from api_common import *
    from api_store import PrototypeStore

def render_home(store: PrototypeStore) -> str:
    summary = store.dashboard_overview()
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Revia — Review and Evaluation Infrastructure for AI Answers</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; line-height: 1.45; max-width: 980px; }}
    code {{ background: #f3f4f6; padding: 2px 5px; border-radius: 4px; }}
    a {{ color: #0645ad; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }}
    .metric {{ border: 1px solid #ddd; border-radius: 6px; padding: 12px; }}
    .metric strong {{ display: block; font-size: 24px; }}
  </style>
</head>
<body>
  <h1>Revia — Review and Evaluation Infrastructure for AI Answers</h1>
  <p>Research software for source-grounded answer evaluation with automated judging, human review, and traceable evidence.</p>
  <div class="grid">
    <div class="metric"><strong>{summary["service_count"]}</strong> services</div>
    <div class="metric"><strong>{summary["question_count"]}</strong> questions</div>
    <div class="metric"><strong>{summary["trace_count"]}</strong> traces</div>
    <div class="metric"><strong>{summary["disagreement_count"]}</strong> disagreements</div>
  </div>
  <h2>Useful Links</h2>
  <ul>
    <li><a href="/dashboard">HTML dashboard</a></li>
    <li><a href="/dashboard/overview">GET /dashboard/overview</a></li>
    <li><a href="/services?limit=10">GET /services?limit=10</a></li>
    <li><a href="/questions?limit=10">GET /questions?limit=10</a></li>
    <li><a href="/traces?limit=5">GET /traces?limit=5</a></li>
    <li><a href="/traces?disagreements=true">GET /traces?disagreements=true</a></li>
    <li><a href="/developer/storage">GET /developer/storage</a></li>
    <li><a href="/developer/runs?limit=10">GET /developer/runs?limit=10</a></li>
  </ul>
  <h2>Example POST</h2>
  <pre><code>curl -X POST http://127.0.0.1:8765/answers/generate \\
  -H 'Content-Type: application/json' \\
  -d '{{"question_id":"q_0001_fictional_community_garden_required_documents"}}'</code></pre>
</body>
</html>"""


def render_dashboard(store: PrototypeStore) -> str:
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>React Frontend Moved</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 40px; max-width: 760px; line-height: 1.45; }
    a { color: #3d5f9f; font-weight: 700; }
    code { background: #eef1ee; border-radius: 5px; padding: 2px 5px; }
  </style>
</head>
<body>
  <h1>React frontend is separate now</h1>
  <p>The Python server is only the backend API. The human-review dashboard has moved to the React frontend.</p>
  <p>Open: <a href="http://127.0.0.1:5173">http://127.0.0.1:5173</a></p>
  <p>Backend API health check: <code>/health</code></p>
</body>
</html>"""
