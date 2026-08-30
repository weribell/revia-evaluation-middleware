#!/usr/bin/env python3
"""REST API entrypoint for the Revia evaluation middleware.

The implementation is split into small dependency-free modules under
``prototype/api_*.py``. This file stays as the CLI entrypoint and compatibility
facade for older tests/imports that use ``prototype.api_server``.
"""

from __future__ import annotations

try:
    from prototype.api_common import *
    from prototype.api_evaluation import *
    from prototype.api_generation import *
    from prototype.api_handler import PrototypeHandler
    from prototype.api_openai import *
    from prototype.api_store import PrototypeStore
    from prototype.api_trace import *
    from prototype.api_views import render_dashboard, render_home
except ModuleNotFoundError:
    from api_common import *
    from api_evaluation import *
    from api_generation import *
    from api_handler import PrototypeHandler
    from api_openai import *
    from api_store import PrototypeStore
    from api_trace import *
    from api_views import render_dashboard, render_home


def build_server(
    host: str,
    port: int,
    data_dir: Path,
    database_path: Path | None = None,
) -> ThreadingHTTPServer:
    store = PrototypeStore(data_dir, database_path=database_path)

    class BoundHandler(PrototypeHandler):
        pass

    BoundHandler.store = store
    return ThreadingHTTPServer((host, port), BoundHandler)


def run(args: argparse.Namespace) -> int:
    database_path = Path(args.database_path) if args.database_path else None
    server = build_server(args.host, args.port, Path(args.data_dir), database_path=database_path)
    print(f"Serving Revia evaluation middleware on http://{args.host}:{args.port}")
    print(f"SQLite evaluation store: {server.RequestHandlerClass.store.database_path}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    parser.add_argument(
        "--database-path",
        default="",
        help="SQLite database for runtime evaluation traces; defaults to DATA_DIR/evaluation_runs.sqlite3",
    )
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    return parser


if __name__ == "__main__":
    load_local_env()
    raise SystemExit(run(build_parser().parse_args()))
