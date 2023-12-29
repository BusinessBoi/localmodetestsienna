document.addEventListener("DOMContentLoaded", () =>
{
	const btnStart	= document.getElementById("recStart");
	const btnStop	= document.getElementById("recStop");

	let mediaRecorder;
	let chunks	= [];

	navigator.mediaDevices.getUserMedia({audio: true}).then(stream =>
	{
		mediaRecorder	= new MediaRecorder(stream);

		mediaRecorder.ondataavailable	= (e) =>
		{
			if (e.data.size > 0)
			{
				chunks.push(e.data);
			}
		}

		mediaRecorder.onstop	= () =>
		{
			const audioBlob	= new Blob(chunks, {type: "audio/wav"});
			const formData	= new FormData();
			formData.append("audio", audioBlob, "recording.wav");

			// Send recorded audio to server
			fetch("/upload", {method: "POST", body: formData})
			.then(response => response.json())
			.then((data) =>
			{
				console.log("Server reply: ", data.reply);

				const voiceID	= "oWAxZDx7w5VEj9dCyTzz";	// Grace

				const ttsStart	= Date.now();

				const options	=
				{
					method:		"POST",
					headers:	{"Content-Type": "application/json"},
					body:		JSON.stringify(
					{
						text:	data.reply
					})
				};

				fetch(
					`https://api.elevenlabs.io/v1/text-to-speech/${voiceID}/stream`,
					options
				)
				.then(res =>
				{
					if (!res.ok)
					{
						throw new Error(`HTTP error: ${res.status}`);
					}

					return res.blob();
				})
				.then(ttsBlob =>
				{
					const ttsURL	= URL.createObjectURL(ttsBlob);

					const ttsElement	= new Audio();
					ttsElement.src		= ttsURL;

					const ttsEnd	= Date.now();
					console.log(`Voice output in ${ttsEnd - ttsStart} ms`);

					ttsElement.play();
				})
				.catch(err => console.error(err));
			})
			.catch(err => console.error("Error uploading audio:", err));

			// Reset chunks for next recording
			chunks	= [];
		}

		btnStart.addEventListener("click", () =>
		{
			mediaRecorder.start();
			btnStart.disabled	= true;
			btnStop.disabled	= false;
		});

		btnStop.addEventListener("click", () =>
		{
			mediaRecorder.stop();
			btnStart.disabled	= false;
			btnStop.disabled	= true;
		});
	})
	.catch(err => console.error("Error accessing microphone:", err));
});