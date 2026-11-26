from agentkernel import PostHook, PreHook


class RagContextInjector(PreHook):
    """RAG context injector: adds Help Center passages to the request."""

    name = "RAG context injector"


class SignatureFooter(PostHook):
    """Signature footer: ends customer replies with the support signature."""

    name = "Signature footer"
