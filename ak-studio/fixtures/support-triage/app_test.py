import pytest
import pytest_asyncio
from agentkernel.test import Test

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def test_client():
    test = Test("app.py", match_threshold=0.80)
    await test.start()
    try:
        yield test
    finally:
        await test.stop()


@pytest.mark.order(1)
async def test_refund_question_goes_to_billing(test_client):
    await test_client.send("!select billing")
    await test_client.send("I want a refund for order [ORDER ID]")
    await test_client.expect(["[EXPECTED REPLY]"])
