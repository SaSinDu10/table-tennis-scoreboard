// src/components/TeamList.jsx
import React, { useState, useEffect } from 'react';
import { List, Card, Avatar, Typography, Spin, Alert, Tag, Space, Button, message, Popconfirm, Tooltip } from 'antd';
import { UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TeamList = ({ teams, loading, error, title = "Registered Teams", onTeamEdited, onTeamDeleted }) => {
    const [deletingId, setDeletingId] = useState(null);


    const handleEditTeam = (teamId) => {
        console.log("Edit team clicked:", teamId);
        message.info('Edit team functionality not implemented yet.');
        if (onTeamEdited) onTeamEdited(teamId);
    };

    const handleDeleteTeam = async (teamId, teamName) => {
        console.log("Attempting to delete team:", teamId);
        setDeletingId(teamId);
        try {
            message.success(`Team "${teamName}" would be deleted. (Not implemented)`);
            if (onTeamDeleted) onTeamDeleted(teamId);
        } catch (err) {
            message.error('Failed to delete team.');
            console.error("Delete error:", err);
        } finally {
            setDeletingId(null);
        }
    };

    if (loading && (!teams || teams.length === 0)) {
        return (
            <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
                <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin size="large" /></div>
            </Card>
        );
    }
    if (error && (!teams || teams.length === 0)) {
        return (
            <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
                <Alert message="Error Loading Teams" description={error} type="error" showIcon />
            </Card>
        );
    }

    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
            {error && teams && teams.length > 0 && (
                <Alert message="Error refreshing teams" description={error} type="warning" showIcon style={{ marginBottom: 16 }} />
            )}

            <List
                grid={{
                    gutter: 16, 
                    xs: 1,
                    sm: 2,
                    md: 3,
                    lg: 4,
                    xl: 5,
                    xxl: 6,
                }}
                dataSource={teams || []}
                loading={loading}
                locale={{ emptyText: 'No teams registered yet.' }}
                renderItem={(team) => (
                    <List.Item>
                        <Card
                            hoverable
                            title={<Text strong>{team.name}</Text>}
                            actions={[
                                <Tooltip title="Edit Team">
                                    <Button type="text" icon={<EditOutlined />} onClick={() => handleEditTeam(team._id)} />
                                </Tooltip>,
                                <Tooltip title="Delete Team">
                                    <Popconfirm
                                        title={`Delete team "${team.name}"?`}
                                        description="Consider impact on matches. This cannot be undone."
                                        onConfirm={() => handleDeleteTeam(team._id, team.name)}
                                        okText="Yes, Delete"
                                        cancelText="No"
                                        okButtonProps={{ loading: deletingId === team._id, danger: true }}
                                    >
                                        <Button type="text" danger icon={<DeleteOutlined />} loading={deletingId === team._id} />
                                    </Popconfirm>
                                </Tooltip>,
                            ]}
                            style={{ minHeight: '280px' }}
                        >
                            <List
                                size="default"
                                dataSource={team.players || []}
                                renderItem={(player) => (
                                    <List.Item key={player._id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <List.Item.Meta
                                            avatar={
                                                <Avatar
                                                    size="large"
                                                    src={player.photoUrl ? `${API_URL}${player.photoUrl}` : undefined}
                                                    icon={!player.photoUrl ? <UserOutlined /> : null}
                                                >
                                                    {!player.photoUrl ? player.name?.charAt(0)?.toUpperCase() : null}
                                                </Avatar>
                                            }
                                            title={<Text style={{ fontSize: '0.9em' }}>{player.name}</Text>}
                                        />
                                    </List.Item>
                                )}
                                locale={{ emptyText: 'No players.' }}
                                style={{ maxHeight: '150px', overflowY: 'auto' }}
                            />
                        </Card>
                    </List.Item>
                )}
            />
        </Card>
    );
};

export default TeamList;