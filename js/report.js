// ============================================================
// CivicFix Citizen Complaint Submission
// Phase 3A - Connect Report Form to Express + SQLite Backend
// ============================================================

const form = document.getElementById("complaintForm");
const imageInput = document.getElementById("complaintImage");
const getLocationBtn = document.getElementById("getLocationBtn");
const locationStatus = document.getElementById("locationStatus");

let currentLatitude = "";
let currentLongitude = "";
let currentAddress = "";
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
// LOCATION / GPS
// ============================================================

if (getLocationBtn) {

    getLocationBtn.addEventListener("click", () => {

        if (!navigator.geolocation) {

            alert("Geolocation is not supported by this browser.");

            return;
        }

        getLocationBtn.disabled = true;
        getLocationBtn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Getting Location...';

        if (locationStatus) {
            locationStatus.textContent = "Getting your current location...";
        }

        navigator.geolocation.getCurrentPosition(

            async (position) => {

                currentLatitude = position.coords.latitude;
                currentLongitude = position.coords.longitude;

                console.log("✅ Latitude:", currentLatitude);
                console.log("✅ Longitude:", currentLongitude);

                // For now, keep the address as coordinates.
                // Reverse geocoding can be added after the GPS flow works.
                currentAddress =
                    `Latitude: ${currentLatitude.toFixed(6)}, ` +
                    `Longitude: ${currentLongitude.toFixed(6)}`;

                if (locationStatus) {

                    locationStatus.innerHTML =
                        `<i class="fa-solid fa-circle-check"></i> ` +
                        `Location Captured<br>` +
                        `<small>${currentAddress}</small>`;

                }

                getLocationBtn.innerHTML =
                    '<i class="fa-solid fa-location-dot"></i> Location Captured';

                getLocationBtn.disabled = false;

            },

            (error) => {

                console.error("❌ Location error:", error);

                let message = "Unable to get your location.";

                switch (error.code) {

                    case error.PERMISSION_DENIED:
                        message =
                            "Location permission was denied. Please allow location access.";
                        break;

                    case error.POSITION_UNAVAILABLE:
                        message =
                            "Your location is currently unavailable.";
                        break;

                    case error.TIMEOUT:
                        message =
                            "Location request timed out. Please try again.";
                        break;

                }

                alert(message);

                if (locationStatus) {
                    locationStatus.textContent = "Location not captured";
                }

                getLocationBtn.innerHTML =
                    '<i class="fa-solid fa-location-crosshairs"></i> Get Current Location';

                getLocationBtn.disabled = false;

            }

        );

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
            formData.append("latitude", currentLatitude);
            formData.append("longitude", currentLongitude);
            formData.append("address", currentAddress);

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