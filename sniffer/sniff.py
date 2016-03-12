import logging
from time import sleep
from sniffer import Sniffer
from flask import Flask, request, jsonify

app = Flask(__name__)

sniffers = {}
INTERFACE = 'wlan0'  # Capturing interface, should be same for all sniffers


level = logging.DEBUG
logger = logging.getLogger('sniffer')
logger.setLevel(level)
FORMAT = '%(asctime)s - %(name)s - %(levelname)s: %(message)s'
logging.basicConfig(format=FORMAT)


@app.route('/start', methods=['POST'])
def start():
    '''
    Take the victim's IP and the hostname of the endpoint that is being
    attacked and set a sniffer on all TLS connections between them.

    Arguments:
    source_ip -- the local network IP of the victim, e.g. 192.168.1.66
    destination_host -- the hostname of the attacked endpoint, e.g. dimkarakostas.com

    Status code for the request:
            409: a sniffer on the same source_ip and destination host already exists
            400: parameters were not properly set
            201: a new sniffer for those arguments has been created
    '''
    data = request.get_json()
    source_ip = data['source_ip']
    destination_host = data['destination_host']

    # Check if a same sniffer already exists
    if (source_ip, destination_host) in sniffers:
        err = '409 - Sniffer (source_ip: {}, destination_host: {}) already exists.'.format(source_ip, destination_host)
        logger.warning(err)
        return str(err), 409

    params = {'source_ip': source_ip,
              'destination_host': destination_host,
              'interface': INTERFACE}

    # Check if parameters are invalid
    try:
        sniffer = Sniffer(params)
    except AssertionError, err:
        logger.warning(err)
        return str(err), 400

    sniffers[(source_ip, destination_host)] = sniffer

    # Start the new sniffer thread and block until it has come to life
    sniffer.start()
    while not sniffer.is_alive():
        sleep(0.01)
    msg = 'Sniffer (source_ip: {}, destination_host: {}) is alive.'.format(source_ip, destination_host)
    logger.debug(msg)

    return msg, 201


@app.route('/get_capture')
def get_capture():
    return 'Not implemented', 200


@app.route('/delete_sniffer')
def delete_sniffer():
    return 'Not implemented', 200


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=9000, debug=True)
