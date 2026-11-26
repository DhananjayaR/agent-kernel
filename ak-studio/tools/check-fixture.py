"""Validates fixtures/support-triage against the real agentkernel package: config.yaml through AKConfig, the test
config through AKTestConfig, every .py compiled, and (when its framework extras are installed) hooks.py imported
and its hook classes instantiated. Run `pnpm check-fixture` (tools/check-fixture.mjs picks ak-py/.venv's Python
when it exists, else python3); exits 0 with a message when agentkernel is missing.

model_validate alone cannot catch a made-up key: most AKConfig sections ignore unknown keys (pydantic's default
`extra="ignore"`). So every key in config.yaml and test-config.yaml is also walked against the models' fields,
recursively: a model's keys must be its fields (or their aliases); a `dict[str, Model]` field is a map whose keys
are names (okf.databases.help-center), so only its values are walked; Optional and union fields try each model and
keep the closest; a model with `extra="allow"` (a bring-your-own provider's settings) accepts any key. The walk
proves itself on planted keys first (self_test), so a broken walk fails instead of passing silently.
"""

import py_compile
import sys
import tempfile
import types
import typing
from pathlib import Path

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "support-triage"


def _is_model(annotation: object) -> bool:
    from pydantic import BaseModel

    return isinstance(annotation, type) and issubclass(annotation, BaseModel)


def _field_names(model: type) -> dict[str, object]:
    """Each key a model accepts (field names and string aliases) and the field's annotation."""
    names: dict[str, object] = {}
    for name, field in model.model_fields.items():
        names[name] = field.annotation
        for alias in (field.alias, field.validation_alias):
            if isinstance(alias, str):
                names[alias] = field.annotation
    return names


def unknown_keys(annotation: object, value: object, path: str = "") -> list[str]:
    """The dotted paths of keys in `value` that `annotation` (a model, map, list, Optional or union) has no field for."""
    origin = typing.get_origin(annotation)
    args = typing.get_args(annotation)
    if origin is typing.Annotated:
        return unknown_keys(args[0], value, path)
    if origin in (typing.Union, types.UnionType):
        candidates = [unknown_keys(arg, value, path) for arg in args if arg is not type(None)]
        return min(candidates, key=len) if candidates else []
    if origin in (dict, typing.Mapping) or (isinstance(origin, type) and issubclass(origin, dict)):
        if not isinstance(value, dict) or len(args) != 2:
            return []
        return [p for key, item in value.items() for p in unknown_keys(args[1], item, f"{path}{key}.")]
    if origin in (list, tuple, set, frozenset):
        if not isinstance(value, list) or not args:
            return []
        return [p for i, item in enumerate(value) for p in unknown_keys(args[0], item, f"{path}{i}.")]
    if _is_model(annotation) and isinstance(value, dict):
        if annotation.model_config.get("extra") == "allow":
            return []
        fields = _field_names(annotation)
        found: list[str] = []
        for key, item in value.items():
            if key not in fields:
                found.append(f"{path}{key}")
            else:
                found.extend(unknown_keys(fields[key], item, f"{path}{key}."))
        return found
    return []


def self_test(config_model: type) -> None:
    """The walk reports planted made-up keys and leaves real ones alone (the check can fail)."""
    planted = {
        "session": {"type": "redis", "redis": {"url": "redis://x", "made_up": 1}},
        "made_up_section": {"enabled": True},
        "okf": {"databases": {"any-name-at-all": {"type": "local", "made_up_db_key": 1}}},
        "sandbox": {"profiles": {"default": {"type": "x", "policy": {"network_egress": "deny"}}}},
        "guardrail": {"input": {"enabled": True, "made_up_guard": 1}},
    }
    found = sorted(unknown_keys(config_model, planted))
    want = sorted(
        [
            "session.redis.made_up",
            "made_up_section",
            "okf.databases.any-name-at-all.made_up_db_key",
            "guardrail.input.made_up_guard",
        ]
    )
    assert found == want, f"key walk self-test: expected {want}, got {found}"
    print(f"key walk self-test: {len(want)} planted keys reported, map names and real keys left alone")


def main() -> int:
    try:
        import yaml
        from agentkernel.core.config import AKConfig
        from agentkernel.test.config import AKTestConfig
    except ImportError as err:
        print(f"check-fixture skipped: agentkernel is not importable here ({err})")
        return 0

    # No __pycache__ left in the fixture (fixture-tree.test.mjs lists its files).
    sys.dont_write_bytecode = True

    self_test(AKConfig)

    for path in sorted(FIXTURE.rglob("*.py")):
        with tempfile.TemporaryDirectory() as tmp:
            py_compile.compile(str(path), cfile=str(Path(tmp) / "x.pyc"), doraise=True)
        print(f"compiled {path.relative_to(FIXTURE)}")

    raw_config = yaml.safe_load((FIXTURE / "config.yaml").read_text())
    config = AKConfig.model_validate(raw_config)
    assert config.guardrail.input.enabled and config.guardrail.output.enabled, "guardrails not enabled"
    assert config.execution.mode == "rest_sync" and config.session.type == "redis"
    unknown = unknown_keys(AKConfig, raw_config)
    assert not unknown, f"config.yaml has keys AKConfig does not define: {unknown}"
    print("config.yaml validated by AKConfig; every key is a field")

    raw_test_config = yaml.safe_load((FIXTURE / "test-config.yaml").read_text())
    test_config = AKTestConfig.model_validate(raw_test_config)
    assert test_config.mode == "fallback"
    unknown = unknown_keys(AKTestConfig, raw_test_config)
    assert not unknown, f"test-config.yaml has keys AKTestConfig does not define: {unknown}"
    print("test-config.yaml validated by AKTestConfig; every key is a field")

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
