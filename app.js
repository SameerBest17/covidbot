const express = require('express');
const ngrok = require('ngrok');
const rp = require('request-promise-native');

const msg = require('./msg');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const INSTANCE_URL = 'https://api.maytapi.com/api';
const PRODUCT_ID = '9b2abd71-0b2b-401b-9caa-c74547ec7c43';
const PHONE_ID = '11795';
const API_TOKEN = '0f694e81-ee0a-464c-a6f9-fe0ba51ddf94';

// Boolen Variable to check if it a Welcome message or not
let welcome = false;

//Check if maytapi cerdientials are correct
if (!PRODUCT_ID || !PHONE_ID || !API_TOKEN) throw Error('You need to change PRODUCT_ID, PHONE_ID and API_KEY values in app.js file.');

//API to reply messages
async function send_message(body) {
	console.log(`Request Body:${JSON.stringify(body)}`);
	let url = `${INSTANCE_URL}/${PRODUCT_ID}/${PHONE_ID}/sendMessage`;
	let response = await rp(url, {
		method: 'post',
		json: true,
		body,
		headers: {
			'Content-Type': 'application/json',
			'x-maytapi-key': API_TOKEN,
		},
	});
	console.log(`Response: ${JSON.stringify(response)}`);
	return response;
}
// SetUp
async function setup_network() {
	let public_url = await ngrok.connect(3000);
	console.log(`Public Url:${public_url}`);
	let webhook_url = `${public_url}/webhook`;
	let url = `${INSTANCE_URL}/${PRODUCT_ID}/setWebhook`;
	let response = await rp(url, {
		method: 'POST',
		body: { webhook: webhook_url },
		headers: {
			'x-maytapi-key': API_TOKEN,
			'Content-Type': 'application/json',
		},
		json: true,
	});
	console.log(`Response: ${JSON.stringify(response)}`);
}
// Get Covid data from Covid api
async function getData(conversation) {
	const request = require('request');
	const options = {
		method: 'GET',
		url: 'https://covid-19-coronavirus-statistics.p.rapidapi.com/v1/total',
		qs: { country: 'Pakistan' },
		headers: {
			'x-rapidapi-key': '2461a7e290msh577d827b4986b86p1ad3e6jsn3003d90e4cbe',
			'x-rapidapi-host': 'covid-19-coronavirus-statistics.p.rapidapi.com',
			useQueryString: true,
		},
	};

	request(options, async function (error, response, body) {
		if (error) throw new Error(error);
		const { data } = JSON.parse(body);
		console.log(data);
		const msgBody = {
			type: 'text',
			message: `Recovered: ${data.recovered}\nDeaths: ${data.deaths}\nConfirmed Cases: ${data.confirmed}\nPress 0 to go back to main menu`,
		};
		msgBody.to_number = conversation;
		await send_message(msgBody).catch((err) => console.error(err));
	});
}

app.get('/', (req, res) => res.send('Hello World!'));

//Express post api to send reply message
app.post('/sendMessage', async (req, res) => {
	let { message, to_number } = req.body;
	let response = await send_message({ type: 'text', message, to_number });
	res.send({ response });
});

// Express post api to recive message and respones accordingly
app.post('/webhook', async (req, res) => {
	res.sendStatus(200);
	let { message, conversation } = req.body;
	if (!message) return;
	let { type, text, fromMe } = message;
	if (fromMe) return;
	if (type === 'text') {
		let body = {};
		let lower = text.toLowerCase();
		switch (lower) {
			case '1':
				await getData(conversation);
				break;
			case '2':
				body = {
					type: 'text',
					message: msg.precautions,
				};
				break;

			case '3':
				body = {
					type: 'text',
					message: msg.remedies,
				};
				break;
			case 'hi':
			case '0':
				body = {
					type: 'text',
					message: msg.menu,
				};
				break;

			default:
				body = { message: msg.menu, type: 'text' };
		}
		body.to_number = conversation;

		//For Welcome Message
		if (lower === 'hi') {
			welcome = true;
			console.log(lower);
			const greet = {
				type: 'text',
				message: `${msg.welcome}`,
			};
			greet.to_number = conversation;
			await send_message(greet)
				.then((res) => (welcome = false))
				.catch((err) => console.error(err));
		}

		// Conition to not send me for covid data before complete data is collected
		if (lower !== '1' && !welcome) {
			await send_message(body).catch((err) => console.error(err));
		}
	} else {
		console.log(`Ignored Message Type:${type}`);
	}
});

app.listen(port, async () => {
	console.log(`Example app listening at http://localhost:${port}`);
	await setup_network();
});
