from agentkernel.adk import GoogleADKModule
from agentkernel.api import RESTAPI
from agentkernel.langgraph import LangGraphModule
from agentkernel.openai import OpenAIModule
from agents import Agent

from hooks import RagContextInjector, SignatureFooter
from tool import create_ticket, lookup_order, refund_payment, search_docs

billing = Agent(
    name="billing",
    model="claude-sonnet-4-5",
    handoff_description="Payment and refund questions",
    instructions="Answer in the customer's language.",
    tools=[lookup_order, refund_payment],
)
kb_researcher = Agent(
    name="kb-researcher",
    model="gemini-2.5-pro",
    handoff_description="Product and how-to questions",
    instructions="Answer in the customer's language.",
    tools=[search_docs],
)
triage = Agent(
    name="triage",
    model="gpt-4o",
    instructions="Answer in the customer's language. Hand off to billing or kb-researcher.",
    handoffs=[billing, kb_researcher],
    tools=[create_ticket],
)

if __name__ == "__main__":
    RESTAPI.run()
