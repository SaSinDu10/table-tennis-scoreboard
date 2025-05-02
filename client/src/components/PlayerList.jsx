// src/components/PlayerList.jsx
import React, { useState, useEffect } from 'react';
import { List, Avatar, Card, Select, Spin, Alert, Typography, Button } from 'antd'; // Added Button
import { UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'; // Added more icons

const { Option } = Select;
const { Title, Text } = Typography;
// Ensure VITE_API_URL is set in your client/.env file
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// This component now receives players, loading, error directly as props from App.jsx
const PlayerList = ({ players, loading, error, title = "Players" }) => {
    const [filteredPlayers, setFilteredPlayers] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');

    // useEffect hook to update the filtered list when the main 'players' prop changes or category filter changes
    useEffect(() => {
        console.log("PlayerList received loading:", loading); // Debug log
        console.log("PlayerList received players:", players); // Debug log
        if (players) { // Check if players prop is valid
             if (selectedCategory === 'All') {
                 setFilteredPlayers(players); // Show all if 'All' selected
             } else {
                 // Filter based on selected category
                 setFilteredPlayers(players.filter(p => p.category === selectedCategory));
             }
        } else {
             setFilteredPlayers([]); // Set to empty if players prop is null/undefined
        }
    }, [selectedCategory, players]); // Dependencies: re-run when filter or players prop changes


    // --- Handlers for Edit/Delete (Placeholder actions) ---
    const handleEditPlayer = (playerId) => {
        console.log("Edit player clicked:", playerId);
        // TODO: Implement edit logic (e.g., open a modal form)
        message.info('Edit functionality not implemented yet.');
    };

    const handleDeletePlayer = (playerId) => {
        console.log("Delete player clicked:", playerId);
        // TODO: Implement delete logic (call DELETE /api/players/:id, show Popconfirm)
        message.info('Delete functionality not implemented yet.');
        // Example (needs Popconfirm and API call):
        // axios.delete(`${API_URL}/api/players/${playerId}`).then(...).catch(...);
    };
    // ------------------------------------------------------


    // --- Display loading state ---
    // Show spinner only if loading is true AND the filtered list is currently empty
    if (loading && filteredPlayers.length === 0) {
        return (
            <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin size="large" />
                </div>
            </Card>
        );
    }

    // --- Display error state ---
    // Show error only if an error occurred AND the filtered list is empty
    if (error && filteredPlayers.length === 0) {
        return (
             <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
                 <Alert message="Error Loading Players" description={error} type="error" showIcon />
             </Card>
        );
    }
    // -------------------------

    // --- Main List Rendering ---
    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
            {/* Category Filter Dropdown */}
            <Select
                defaultValue="All"
                style={{ width: 200, marginBottom: 20 }}
                onChange={(value) => setSelectedCategory(value)}
                disabled={loading} // Disable select while loading might be happening
            >
                <Option value="All">All Categories</Option>
                <Option value="Super Senior">Super Senior</Option>
                <Option value="Senior">Senior</Option>
                <Option value="Junior">Junior</Option>
            </Select>

            {/* Player List using Ant Design List component */}
            <List
                itemLayout="horizontal"
                dataSource={filteredPlayers} // Use the locally filtered players
                loading={loading && filteredPlayers.length > 0} // Show subtle list loading overlay if loading but data exists
                locale={{ emptyText: 'No players found matching the criteria.' }} // Message when list is empty
                pagination={{ // Optional pagination
                    pageSize: 5,
                    hideOnSinglePage: true,
                    showSizeChanger: false,
                 }}
                renderItem={(player) => ( // Render function for each player
                    <List.Item
                        key={player._id} // Unique key for each item
                        actions={[ // Placeholder actions - Implement Edit/Delete later
                            <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => handleEditPlayer(player._id)} />,
                            <Button key="delete" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeletePlayer(player._id)} />,
                        ]}
                    >
                        <List.Item.Meta
                            avatar={ // Display player avatar or fallback
                                <Avatar
                                    size={64}
                                    src={player.photoUrl ? `${API_URL}${player.photoUrl}` : undefined}
                                    icon={!player.photoUrl ? <UserOutlined /> : null}
                                    alt={player.name}
                                >
                                    {/* Fallback initials */}
                                    {!player.photoUrl ? player.name?.charAt(0)?.toUpperCase() : null}
                                </Avatar>
                            }
                            title={<Text strong>{player.name}</Text>} // Display player name (bold)
                            description={player.category} // Display player category
                        />
                    </List.Item>
                )}
            />
        </Card>
    );
};

export default PlayerList; 