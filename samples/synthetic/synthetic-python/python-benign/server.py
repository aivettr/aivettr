"""Python MCP server 负样本：单变量环境读取与纯计算，不触发任何规则。"""

import os


def echo(q: str):
    """Echo a message back, noting whether an echo token is configured."""

    token = os.environ.get("ECHO_TOKEN", "")
    return {"echo": q, "configured": bool(token), "length": len(q)}
