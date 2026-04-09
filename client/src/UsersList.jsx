import { useState, useEffect } from "react"

const UsersList = ({ onSelectUser }) => {

    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetch('/api/users')
            .then(res => res.json())
            .then(data => setUsers(data))
    }, []);

    return (
        <ul>
            {users.map((user) => (
                <li onClick={() => onSelectUser(user.username)}>{user.username}
                </li>
            ))}
        </ul>
    );
}
export default UsersList;