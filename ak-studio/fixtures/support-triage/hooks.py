from agentkernel import Agent, PostHook, PreHook, Session
from agentkernel.core.model import AgentReply, AgentReplyText, AgentRequest


class RagContextInjector(PreHook):
    """Pre-hook "RAG context injector": adds Help Center context to the request."""

    async def on_run(
        self, session: Session, agent: Agent, requests: list[AgentRequest]
    ) -> list[AgentRequest] | AgentReply:
        return requests  # [placeholder] context lookup

    def name(self) -> str:
        return "RAG context injector"


class SignatureFooter(PostHook):
    """Post-hook "Signature footer": ends customer replies with the support signature."""

    async def on_run(
        self, session: Session, requests: list[AgentRequest], agent: Agent, agent_reply: AgentReply
    ) -> AgentReply:
        if isinstance(agent_reply, AgentReplyText):
            agent_reply.response += "\n\n[SUPPORT SIGNATURE]"
        return agent_reply

    def name(self) -> str:
        return "Signature footer"
