// src/components/PlayerList.jsx
import React, { useState, useEffect } from 'react';
import { List, Avatar, Card, Select, Spin, Alert, Typography, Button } from 'antd';
import { UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';


const PlayerList = ({ players, loading, error, title = "Players" }) => {
    const [filteredPlayers, setFilteredPlayers] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        console.log("PlayerList received loading:", loading);
        console.log("PlayerList received players:", players);
        if (players) {
            if (selectedCategory === 'All') {
                setFilteredPlayers(players);
            } else {
                setFilteredPlayers(players.filter(p => p.category === selectedCategory));
            }
        } else {
            setFilteredPlayers([]);
        }
    }, [selectedCategory, players]);


    // --- Handlers for Edit/Delete---
    const handleEditPlayer = (playerId) => {
        console.log("Edit player clicked:", playerId);
        // TODO: Implement edit logic (e.g., open a modal form)
        message.info('Edit functionality not implemented yet.');
    };

    const handleDeletePlayer = (playerId) => {
        console.log("Delete player clicked:", playerId);
        // TODO: Implement delete logic (call DELETE /api/players/:id, show Popconfirm)
        message.info('Delete functionality not implemented yet.');
    };


    if (loading && filteredPlayers.length === 0) {
        return (
            <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin size="large" />
                </div>
            </Card>
        );
    }


    if (error && filteredPlayers.length === 0) {
        return (
            <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
                <Alert message="Error Loading Players" description={error} type="error" showIcon />
            </Card>
        );
    }

    // --- Main List Rendering ---
    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>

            <Select
                defaultValue="All"
                style={{ width: 200, marginBottom: 20 }}
                onChange={(value) => setSelectedCategory(value)}
                disabled={loading}
            >
                <Option value="All">All Categories</Option>
                <Option value="Super Senior">Super Senior</Option>
                <Option value="Senior">Senior</Option>
                <Option value="Junior">Junior</Option>
            </Select>

            {/* Player List using Ant Design List component */}
            <List
                itemLayout="horizontal"
                dataSource={filteredPlayers} 
                loading={loading && filteredPlayers.length > 0} 
                locale={{ emptyText: 'No players found matching the criteria.' }}
                pagination={{ 
                    pageSize: 5,
                    hideOnSinglePage: true,
                    showSizeChanger: false,
                }}
                renderItem={(player) => (
                    <List.Item
                        key={player._id}
                        actions={[
                            <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => handleEditPlayer(player._id)} />,
                            <Button key="delete" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeletePlayer(player._id)} />,
                        ]}
                    >
                        <List.Item.Meta
                            avatar={
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
                            title={<Text strong>{player.name}</Text>}
                            description={player.category}
                        />
                    </List.Item>
                )}
            />
        </Card>
    );
};

export default PlayerList; 