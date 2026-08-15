// ============================================================
// CivicFix Citizen Complaint Submission
// Phase 3A - Connect Report Form to Express + SQLite Backend
// ============================================================

const form = document.getElementById("complaintForm");
const imageInput = document.getElementById("complaintImage");

// Backend URL for current local development.
// Later, when we deploy CivicFix, this can become a relative API path.
const API_BASE_URL = "http://localhost:3000";

if (!form) {
    console.error("❌ complaintForm was not found.");
}

if (!imageInput) {
    console.error("❌ complaintImage input was not found.");
}


// ============================================================
// IMAGE PREVIEW / VALIDATION
// ============================================================

if (imageInput) {

    imageInput.addEventListener("change", () => {

        const file = imageInput.files[0];

        if (!file) {
            return;
        }

        // Basic client-side validation
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {

            alert("Please select a JPG, PNG, or WEBP image.");

            imageInput.value = "";

            return;
        }

        // Backend currently accepts up to 10 MB.
        const maxSize = 10 * 1024 * 1024;

        if (file.size > maxSize) {

            alert("Image size must be below 10 MB.");

            imageInput.value = "";

            return;
        }

        console.log("✅ Image selected:", file.name);

    });

}


// ============================================================
// FORM SUBMISSION
// ============================================================

if (form) {

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');

        try {

            // ----------------------------------------------------
            // Read form values
            // ----------------------------------------------------

            const name =
                document.getElementById("name")?.value.trim() || "";

            const email =
                document.getElementById("email")?.value.trim() || "";

            const phone =
                document.getElementById("phone")?.value.trim() || "";

            const category =
                document.getElementById("category")?.value.trim() || "";

            const description =
                document.getElementById("description")?.value.trim() || "";

            const file =
                imageInput?.files?.[0] || null;


            // ----------------------------------------------------
            // Basic validation
            // ----------------------------------------------------

            if (!name) {
                alert("Please enter your full name.");
                return;
            }

            if (!email) {
                alert("Please enter your email address.");
                return;
            }

            if (!phone) {
                alert("Please enter your phone number.");
                return;
            }

            if (!category) {
                alert("Please select an issue category.");
                return;
            }

            if (!description) {
                alert("Please describe the civic issue.");
                return;
            }

            if (!file) {
                alert("Please upload a photo of the issue.");
                return;
            }


            // ----------------------------------------------------
            // Build multipart request
            // ----------------------------------------------------

            const formData = new FormData();

            formData.append("citizen_name", name);
            formData.append("citizen_email", email);
            formData.append("citizen_phone", phone);
            formData.append("category", category);
            formData.append("description", description);

            // Location fields are currently optional.
            // We'll wire the GPS button in the next step.
            formData.append("latitude", "");
            formData.append("longitude", "");
            formData.append("address", "");

            // IMPORTANT:
            // Backend Multer expects the field name "image".
            formData.append("image", file);


            // ----------------------------------------------------
            // Loading state
            // ----------------------------------------------------

            if (submitButton) {

                submitButton.disabled = true;
                submitButton.textContent = "Submitting Complaint...";

            }


            // ----------------------------------------------------
            // Send complaint to Express backend
            // ----------------------------------------------------

            console.log("🚀 Sending complaint to CivicFix backend...");

            const response = await fetch(
                `${API_BASE_URL}/api/complaints`,
                {
                    method: "POST",
                    body: formData
                }
            );


            // ----------------------------------------------------
            // Read backend response
            // ----------------------------------------------------

            const result = await response.json();

            console.log("Backend Response:", result);


            // ----------------------------------------------------
            // Handle failure
            // ----------------------------------------------------

            if (!response.ok || !result.success) {

                throw new Error(
                    result.message || "Complaint submission failed."
                );

            }


            // ----------------------------------------------------
            // SUCCESS
            // ----------------------------------------------------

            const complaintCode =
                result.complaint_code || "Unavailable";

            const analysis =
                result.analysis || {};


            alert(
                "✅ Complaint Submitted Successfully!\n\n" +
                "Complaint ID: " + complaintCode + "\n\n" +
                "AI Category: " +
                (analysis.category || "Not available") +
                "\n" +
                "Priority: " +
                (analysis.priority || "Not available") +
                "\n" +
                "Severity: " +
                (analysis.severity ?? "Not available")
            );


            console.log("✅ Complaint successfully stored.");

            console.log("Complaint Code:", complaintCode);

            console.log("AI Analysis:", analysis);


            // Clear form
            form.reset();


        } catch (error) {

            console.error("❌ Complaint submission error:", error);

            alert(
                "Unable to submit the complaint.\n\n" +
                error.message
            );

        } finally {

            if (submitButton) {

                submitButton.disabled = false;
                submitButton.textContent = "Submit Complaint";

            }

        }

    });

}