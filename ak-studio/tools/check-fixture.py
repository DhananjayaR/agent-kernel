"""Validates fixtures/support-triage against the real agentkernel package: config.yaml through AKConfig, the test
config through AKTestConfig, every .py compiled, and (when its framework extras are installed) hooks.py imported
and its hook classes instantiated. Run `pnpm check-fixture`; exits 0 with a message when agentkernel is missing.

Use a Python that has agentkernel, e.g. ak-py's venv: `ak-py/.venv/bin/python tools/check-fixture.py`.
"""

import py_compile
import sys
import tempfile
from pathlib import Path

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "support-triage"


def main() -> int:
    try:
        import yaml
        from agentkernel.core.config import AKConfig
        from agentkernel.test.config import AKTestConfig
    except ImportError as err:
        print(f"check-fixture skipped: agentkernel is not importable here ({err})")
        return 0

    for path in sorted(FIXTURE.rglob("*.py")):
        with tempfile.TemporaryDirectory() as tmp:
            py_compile.compile(str(path), cfile=str(Path(tmp) / "x.pyc"), doraise=True)
        print(f"compiled {path.relative_to(FIXTURE)}")

    config = AKConfig.model_validate(yaml.safe_load((FIXTURE / "config.yaml").read_text()))
    assert config.guardrail.input.enabled and config.guardrail.output.enabled, "guardrails not enabled"
    assert config.execution.mode == "rest_sync" and config.session.type == "redis"
    print("config.yaml validated by AKConfig")

    test_config = AKTestConfig.model_validate(yaml.safe_load((FIXTURE / "test-config.yaml").read_text()))
    assert test_config.mode == "fallback"
    print("test-config.yaml validated by AKTestConfig")

    sys.path.insert(0, str(FIXTURE))
    try:
        import hooks
    except ImportError as err:
        print(f"hooks.py not imported (missing optional extra?): {err}")
        return 0
    for cls in (hooks.RagContextInjector, hooks.SignatureFooter):
        print(f"{cls.__name__} -> {cls().name()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
