const imageInput = document.getElementById("complaintImage");

let uploadedImageURL = "";
imageInput.addEventListener("change", async function () {

    const file = imageInput.files[0];

    await analyzeImage(file);

    if (!file) return;

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    try {

        const response = await fetch(
            "https://api.cloudinary.com/v1_1/anqmiril/image/upload",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        uploadedImageURL = data.secure_url;

        console.log(data);

    } catch (error) {

        console.error(error);

        alert("Upload failed.");

    }

});

const form = document.getElementById("complaintForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const complaint = {

        name: document.getElementById("name").value,

        email: document.getElementById("email").value,

        phone: document.getElementById("phone").value,

        category: document.getElementById("category").value,

        description: document.getElementById("description").value,

        status: "Pending",

        priority: "Waiting for AI",

        createdAt: new Date()

    };

    try {

        const complaintId = await saveComplaint(complaint);

        alert("Complaint Submitted Successfully!\n\nComplaint ID: " + complaintId);

        form.reset();

    } catch (error) {

        alert("Failed to submit complaint.");

        console.error(error);

    }

});