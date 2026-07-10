async function analyzeImage(file) {

    // Convert image to Base64
    const base64Image = await new Promise((resolve) => {

        const reader = new FileReader();

        reader.onload = () => {

            resolve(reader.result.split(",")[1]);

        };

        reader.readAsDataURL(file);

    });

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                contents: [

                    {

                        parts: [

                            {

                                text:
                                    `You are an AI Civic Complaint Analyzer.

Return ONLY JSON.

{
"category":"",
"priority":"",
"severity":"",
"reason":""
}

Rules:

Water leakage / pipe burst / flood = Critical

Road damage = High

Garbage = Medium

Street light = Low

Severity should be between 1 and 10.`

                            },

                            {

                                inline_data: {

                                    mime_type: "image/jpeg",

                                    data: base64Image

                                }

                            }

                        ]

                    }

                ]

            })

        }

    );

    const data = await response.json();

    console.log("Gemini Result");

    console.log(data);

    return data;

}