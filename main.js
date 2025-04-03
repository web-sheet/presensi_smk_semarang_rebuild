import fetch from 'node-fetch';
import qrcode from 'qrcode-terminal'; 
import pkg from 'whatsapp-web.js';
import express from 'express';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client, LocalAuth} = pkg;

const linkGsheet = 'https://script.google.com/macros/s/AKfycbyQKkfq3srqUeDaWCfUoig-Vv_10yw8xXoNJ9tG9PTN54oRFzuB0TeNqJVEZk3KkimS/exec';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'] 
});

const PORT = process.env.PORT || 5000; 
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.use(express.json());
app.use(express.static('public')); 

app.post('/sendMessages', async (req, res) => {
    const { number, message } = req.body;
    try {
        await sendMessageToNumber(number, message);
        res.status(200).send({ result: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send({ error: 'Failed to send message' });
    }
});





const client = new Client(
      
         { restartOnAuthFail: true, 
        authStrategy: new LocalAuth(),        
         puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] } });


app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/sendMessagePage', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tesPesan.html'));
});


client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    io.emit('qr', qr);  
});


let isMessageListenerSet = false; // Flag to track listener setup

client.on('ready', () => {
    console.log('Client is ready!');
    io.emit('clientConnected'); // Emit event to notify client
    if (!isMessageListenerSet) {
        setupMessageListener(); 
        isMessageListenerSet = true; 
    }
});

 

function setupMessageListener() {
  
    client.on('message_create', async (message) => {
        if (message.from === client.info.wid._serialized) {
            return; 
        }
    
        
        const messageBody = message.body;
        console.log(`Received message: ${messageBody}`);
    
        try {
            if (message.type === 'location') {
                const sender = message.from;
                const { latitude, longitude,  url, name  } = message.location;
                console.log(`Received location: Latitude: ${latitude}, Longitude: ${longitude}, Deskripsi:   ${url}, Nama: ${name} `, );
                await saveLocationToGoogleSheets(sender, latitude, longitude, url, name);
                console.log(`Location saved for ${sender}`); // Log success
                
              
                await handleResponse(sender);
                return; 
            } 
    
          
        } catch (error) {
            console.error(`Error processing message: ${error.message}`); // Log error
        }
    });
   
   
}
    
    client.on('qr', qr => {
    // Generate QR code and send it to the frontend
    qrcode.generate(qr, { small: true });
    // Emit the QR code to the frontend
    io.emit('qr', qr); 
});



async function saveLocationToGoogleSheets(sender, latitude, longitude, url, name) {
    try {
     
           const response = await fetch(linkGsheet, {
          
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender, latitude, longitude, url, name }),
        });
        const data = await response.json();
        console.log('Location saved to Google Sheets:', data);
    } catch (error) {
        console.error('Error saving location:', error);
    }
}



async function handleResponse(sender) {
    try {
        
        const response = await fetch(`${linkGsheet}?query=${sender}`);      
        const data = await response.json();
        
        // Check if the response is not empty
        if (data.response) {
            const reply = data.response.replace(/\\n/g, "\n");
            client.sendMessage(sender, reply);
        }
        // If data.response is empty, do not send any message

    } catch (error) {
        console.error('Error fetching response:', error);
        client.sendMessage(sender, 'Sorry, I could not process your request.');
    }
}

async function sendMessageToNumber(number, message) {
    try {
        const chatId = `${number}@c.us`; // WhatsApp chat ID format
        await client.sendMessage(chatId, message);
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message'); // Rethrow the error for further handling
    }
}

// Initialize the client
client.initialize();

client.on('disconnected', async (reason) => {
    console.log('Client was logged out:', reason);
    await client.destroy(); // Properly destroy the client instance
    await client.initialize(); // Re-initialize the client

    // Re-establish the QR code listener
    client.on('qr', qr => {
        qrcode.generate(qr, { small: true });
        io.emit('qr', qr);  
    });

    client.on('ready', () => {
    console.log('Client is ready!');
    if (!isMessageListenerSet) {
        setupMessageListener(); // Set up message listeners only once
        isMessageListenerSet = true; // Update the flag
    }
    });


});

 





 
