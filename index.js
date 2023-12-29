import "dotenv/config";
import express from "express";
import multer from "multer";
import { spawn } from 'child_process';
import path from "path";
import Replicate from "replicate";

// Initialise Express
const app = express();

// Configure Multer to handle audio files
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialise Replicate client
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

let transcription = null;

// Middleware function to process transcription result and send it to Phi-2
const processTranscription = async (req, res) => {
    if (transcription) {
        try {
            const phi2Command = 'ollama run phi';
            const phi2 = spawn('wsl', [phi2Command]);

            let phi2Output = '';
            phi2.stdout.on('data', (data) => {
                phi2Output += data.toString();
            });

            phi2.stderr.on('data', (data) => {
                console.error(`Phi-2 Error: ${data}`);
            });

            phi2.on('close', (code) => {
                if (code === 0) {
                    console.log(`Phi-2 Output: ${phi2Output}`);
                    res.status(200).json({ reply: phi2Output });
                } else {
                    console.error(`Phi-2 process exited with code ${code}`);
                    res.status(500).json({ error: "Internal Server Error during Phi-2 processing" });
                }
            });

            // Send the transcription text to Phi-2
            phi2.stdin.write(transcription);
            phi2.stdin.end();

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    } else {
        res.status(400).json({ error: "Bad Request: Transcription missing" });
    }
};

// Routes
app.get('/', (req, res) => {
    // Serve HTML form for file upload
    var filePath = "public/index.htm";
    var resolvedPath = path.resolve(filePath);
    return res.sendFile(resolvedPath);
});

// Handle file upload
app.post("/upload", upload.single("audio"), async (req, res, next) => {
    try {
        const transcribeStart = Date.now();

        const model = "openai/whisper:4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2";

        const audioData = req.file.buffer;    // Get audio data as Buffer
        const base64 = audioData.toString("base64");
        const dataURI = `data:;base64,${base64}`;

        const input = { audio: dataURI };

        const output = await replicate.run(model, { input });
        transcription = output.transcription;
        console.log(transcription);

        const transcribeEnd = Date.now();
        console.log(`Transcribed in ${transcribeEnd - transcribeStart} ms`);
        next();
    } catch (error) {
        console.error("Error during transcription: ", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Use processTranscription middleware immediately after uploadFunc route
app.use("/upload", processTranscription);

// Start the servers
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
