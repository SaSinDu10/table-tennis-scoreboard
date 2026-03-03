// src/components/PlayerList.jsx
import React, { useState, useEffect } from 'react';
import {
    List, Avatar, Card, Select, Spin, Alert, Typography, Button, message,
    Popconfirm, Modal, Form, Input, Space
} from 'antd';
import { UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';


const PlayerList = ({ players, loading, error, title = "Players", onListUpdate }) => {
    const [filteredPlayers, setFilteredPlayers] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editForm] = Form.useForm();

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


    // --- Edit Handlers ---
    const handleEditClick = (player) => {
        setEditingPlayer(player);
        editForm.setFieldsValue({
            name: player.name,
            category: player.category
        });
        setIsModalVisible(true);
    };

    const handleEditCancel = () => {
        setIsModalVisible(false);
        setEditingPlayer(null);
        editForm.resetFields();
    };

    const handleEditFinish = async (values) => {
        setIsSubmitting(true);
        try {
            const response = await axios.put(`${API_URL}/api/players/${editingPlayer._id}`, values);
            message.success('Player updated successfully!');
            handleEditCancel();
            if (onListUpdate) {
                console.log("Calling onListUpdate after edit...");
                onListUpdate(); // Tell App.jsx to refetch
            }
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to update player.");
        } finally {
            setIsSubmitting(false);
        }
    };
    // -------------------

    // --- Delete Handler ---
    const handleDeletePlayer = async (playerId) => {
        try {
            const response = await axios.delete(`${API_URL}/api/players/${playerId}`);
            message.success(response.data?.message || 'Player deleted successfully!');
            if (onListUpdate) {
                console.log("Calling onListUpdate after delete...");
                onListUpdate(); // Tell App.jsx to refetch
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to delete player.');
            // --- FIX: Log the full response object for better error details ---
            console.error("Delete player error:", error.response);
            // ---------------------------------------------------------------
        }
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
        <>
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
                    locale={{ emptyText: 'No players found.' }}
                    pagination={{ pageSize: 10, hideOnSinglePage: true }}
                    renderItem={(player) => (
                        <List.Item
                            key={player._id}
                            actions={[
                                <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => handleEditClick(player)} />,
                                <Popconfirm
                                    key="delete"
                                    title={`Delete ${player.name}?`}
                                    description="This is only possible if the player is not in any matches."
                                    onConfirm={() => handleDeletePlayer(player._id)}
                                    okText="Yes, Delete"
                                    cancelText="No"
                                >
                                    <Button key="delete" type="text" danger icon={<DeleteOutlined />} />
                                </Popconfirm>,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={
                                    <Avatar
                                        size={64}
                                        src={player.photoUrl ? `${API_URL}${player.photoUrl}` : undefined}
                                        icon={!player.photoUrl ? <UserOutlined /> : null}
                                    >
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

            <Modal
                title={`Edit Player: ${editingPlayer?.name}`}
                open={isModalVisible}
                onCancel={handleEditCancel}
                footer={[
                    <Button key="back" onClick={handleEditCancel}>Cancel</Button>,
                    <Button key="submit" type="primary" loading={isSubmitting} onClick={() => editForm.submit()}>
                        Save Changes
                    </Button>,
                ]}
                destroyOnHidden
            >
                <Form form={editForm} layout="vertical" onFinish={handleEditFinish}>
                    <Form.Item name="name" label="Player Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                        <Select>
                            <Option value="Super Senior">Super Senior</Option>
                            <Option value="Senior">Senior</Option>
                            <Option value="Junior">Junior</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default PlayerList; 