from agents import function_tool


@function_tool
def lookup_order(order_id: str) -> dict:
    """Look up an order by id."""
    return {"order_id": order_id, "status": "[STATUS]"}


@function_tool(needs_approval=lambda _ctx, args, _id: args["amount"] > 200)
def refund_payment(order_id: str, amount: float) -> dict:
    """Refund a payment. Human approval when amount > 200."""
    return {"order_id": order_id, "refunded": amount}


@function_tool
def search_docs(query: str) -> list[str]:
    """Search the Help Center."""
    return []


@function_tool
def create_ticket(subject: str, body: str) -> dict:
    """Create a support ticket."""
    return {"ticket_id": "[ID]", "subject": subject}
