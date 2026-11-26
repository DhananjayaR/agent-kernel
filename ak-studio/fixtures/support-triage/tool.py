"""Custom tools: plain functions, bound to each framework with its OAK ToolBuilder in app.py."""


def lookup_order(order_id: str) -> str:
    """
    Look up an order.

    :param order_id: The order id.
    :return: The order status.
    """
    return f"Order {order_id}: [STATUS]"


def refund_payment(order_id: str, amount: float) -> str:
    """
    Refund a payment. Needs human approval when the amount is above 200 (see needs_approval_over_limit).

    :param order_id: The order to refund.
    :param amount: The amount to refund.
    :return: Confirmation of the refund.
    """
    return f"Refunded {amount:.2f} for {order_id}."


async def needs_approval_over_limit(_context, params: dict, _call_id: str) -> bool:
    """The OpenAI Agents SDK approval condition for refund_payment: amount > 200."""
    return float(params.get("amount", 0)) > 200


def search_docs(query: str) -> str:
    """
    Search the Help Center.

    :param query: What to look for.
    :return: Matching articles.
    """
    return f"[RESULTS for {query}]"


def create_ticket(subject: str, body: str) -> str:
    """
    Create a support ticket.

    :param subject: The ticket subject.
    :param body: The ticket text.
    :return: The ticket id.
    """
    return "[TICKET ID]"
