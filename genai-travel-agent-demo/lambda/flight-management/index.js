
exports.handler = async (event) => {
    console.log(event);

    const parameters = {};
    for(const parameter of event.parameters) {
        parameters[parameter.name] = parameter.value;
    }

    let result;

    switch (event.function) {
        case 'FlightSearch':
            const search = {
                origin: parameters.origin,
                destination: parameters.destination,
                departureDate: parameters.departureDate,
                returnDate: parameters.returnDate
            };
            console.log('Searching flight: ', search);
            result = flightSearch(search);

            break;

        case 'FlightBook':
            const flight = {
                id: parameters.flightId
            };
            console.log('Reserving flight: ', flight);
            result = flightBook(flight);

            break;

        case 'FlightCancel':
            const reserve = {
                confirmation: parameters.confirmation
            };
            console.log('Cancelling flight: ', reserve);
            result = flightCancel(reserve);

            break;

        default:
            throw new Error('Function not supported');
    }

    console.log('Result: ', result);

    const response = {
        messageVersion: event.messageVersion,
        response: {
            actionGroup: event.actionGroup,
            function: event.function,
            functionResponse: {
                responseBody: {
                    'TEXT': {
                        body: JSON.stringify(result)
                    }
                }
            }
        }
    };

    return response;
};

function flightSearch(params) {
    const flights = [
        { id: 1, airline: 'Delta', price: 500 },
        { id: 2, airline: 'United', price: 450 },
        { id: 3, airline: 'American', price: 400 }
    ];

    return flights;
}

function flightBook(flight) {
    const reservation = {
        confirmation: 'COFF33'
    };

    return reservation;
}

function flightCancel(flight) {
    const cancellation = {
        status: 'success'
    };

    return cancellation;
}