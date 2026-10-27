import asyncio
import logging
logging.basicConfig(level=logging.WARNING)

from amqtt.broker import Broker

config = {
    'listeners': {
        'default': {
            'type': 'tcp',
            'bind': '0.0.0.0:1883',
            'max_connections': 50,
        },
    },
    'auth': {
        'allow-anonymous': True,
        'plugins': [],
    },
    'topic-check': {
        'enabled': False,
    },
}

async def main():
    broker = Broker(config)
    await broker.start()
    print('MQTT broker running on port 1883', flush=True)
    await asyncio.get_event_loop().create_future()  # run forever

asyncio.run(main())
