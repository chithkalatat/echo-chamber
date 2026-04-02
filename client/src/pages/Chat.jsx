import { useNavigate } from "react-router-dom";

export default function Chat() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div>
                <h1 className="text-3xl mb-6">Welcome to the Chat!</h1>
                <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}
