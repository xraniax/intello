import asyncio

async def my_gen():
    yield "a"
    await asyncio.sleep(0.5)
    yield "b"

async def main():
    iterator = my_gen().__aiter__()
    pending_task = None

    async def _get_next():
        return await iterator.__anext__()

    while True:
        if pending_task is None:
            pending_task = asyncio.create_task(_get_next())

        try:
            print("Waiting for 0.1s")
            raw = await asyncio.wait_for(asyncio.shield(pending_task), timeout=0.1)
            pending_task = None
            print("Got:", raw)
        except asyncio.TimeoutError:
            print("Timeout, continuing")
            continue
        except StopAsyncIteration:
            print("Done")
            break

asyncio.run(main())
