async function saveComplaint(complaintData) {

    try {

        const docRef = await db.collection("complaints").add(complaintData);

        console.log("Complaint Saved:", docRef.id);

        return docRef.id;

    } catch (error) {

        console.error("Firestore Error:", error);

        throw error;

    }

}