from agentkernel.adk import GoogleADKModule, GoogleADKToolBuilder
from agentkernel.api import RESTAPI
from agentkernel.langgraph import LangGraphModule, LangGraphToolBuilder
from agentkernel.openai import OpenAIModule, OpenAIToolBuilder
from agents import Agent
from google.adk.agents import Agent as ADKAgent
from langchain_anthropic import ChatAnthropic
from langgraph.prebuilt import create_react_agent

from hooks import RagContextInjector, SignatureFooter
from tool import create_ticket, lookup_order, refund_payment, search_docs

# triage: OpenAI Agents SDK. Agents of different frameworks run in one runtime but do not call each other
# (docs/frameworks/multi-framework.md), so the hand-offs to billing and kb-researcher are described to the
# customer and routed by the channel or by selecting the agent, not by an SDK hand-off.
triage = Agent(
    name="triage",
    model="gpt-4o",
    instructions=(
        "Answer in the customer's language. Payment and refund questions go to billing; product and how-to "
        "questions go to kb-researcher."
    ),
    tools=OpenAIToolBuilder.bind([create_ticket]),
)

# billing: LangGraph. Refunds above 200 need approval (BR-004); the condition is needs_approval_over_limit in
# tool.py. [placeholder] LangGraph pauses with interrupt(), which this fixture does not wire.
billing = create_react_agent(
    name="billing",
    model=ChatAnthropic(model="claude-sonnet-4-5"),
    tools=LangGraphToolBuilder.bind([lookup_order, refund_payment]),
    prompt="You handle payment and refund questions. Answer in the customer's language.",
)

# kb-researcher: Google ADK.
kb_researcher = ADKAgent(
    name="kb_researcher",
    model="gemini-2.5-pro",
    description="Product and how-to questions",
    instruction="You answer product and how-to questions from the Help Center. Answer in the customer's language.",
    tools=GoogleADKToolBuilder.bind([search_docs]),
)

# The RAG context injector runs before triage and kb-researcher; the Signature footer after them.
# billing has no Signature footer yet: it is not registered there (BR-009, out of sync).
OpenAIModule([triage]).pre_hook(triage, [RagContextInjector()]).post_hook(triage, [SignatureFooter()])
LangGraphModule([billing])
GoogleADKModule([kb_researcher]).pre_hook(kb_researcher, [RagContextInjector()]).post_hook(
    kb_researcher, [SignatureFooter()]
)

if __name__ == "__main__":
    RESTAPI.run()
