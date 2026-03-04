// src/components/TeamList.jsx
import React, { useState, useEffect } from 'react';
import {
    List, Card, Avatar, Typography, Spin, Alert, Button, message,
    Popconfirm, Modal, Form, Input, Select, Upload, Space, Tooltip
} from 'antd';
import { UserOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TeamList = ({ teams, loading, error, title = "Registered Teams", onListUpdate }) => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingTeam, setEditingTeam] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [allPlayers, setAllPlayers] = useState([]);
    const [loadingModalPlayers, setLoadingModalPlayers] = useState(false);
    const [logoFileList, setLogoFileList] = useState([]);
    const [editForm] = Form.useForm();

    // Fetch all players for the edit modal dropdown
    useEffect(() => {
        if (isModalVisible) {
            setLoadingModalPlayers(true);
            axios.get(`${API_URL}/api/players`)
                .then(response => setAllPlayers(response.data || []))
                .catch(() => message.error('Could not load players list for editing.'))
                .finally(() => setLoadingModalPlayers(false));
        }
    }, [isModalVisible]);

    // --- Edit Handlers ---
    const handleEditClick = (team) => {
        setEditingTeam(team);
        editForm.setFieldsValue({
            name: team.name,
            playerIds: team.players.map(p => p._id),
        });
        if (team.logoUrl) {
            setLogoFileList([{ uid: '-1', name: 'logo.png', status: 'done', url: `${API_URL}${team.logoUrl}` }]);
        }
        setIsModalVisible(true);
    };

    const handleModalCancel = () => {
        setIsModalVisible(false);
        setEditingTeam(null);
        setLogoFileList([]);
        editForm.resetFields();
    };

    const handleEditFinish = async (values) => {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('name', values.name);
        (values.playerIds || []).forEach(pId => formData.append('playerIds', pId));
        if (logoFileList.length > 0 && logoFileList[0].originFileObj) {
            formData.append('teamLogo', logoFileList[0].originFileObj);
        }
        try {
            await axios.put(`${API_URL}/api/teams/${editingTeam._id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            message.success('Team updated successfully!');
            handleModalCancel();
            if (onListUpdate) onListUpdate();
        } catch (err) {
            message.error(err.response?.data?.message || "Failed to update team.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Delete Handler ---
    const handleDeleteTeam = async (teamId) => {
        try {
            await axios.delete(`${API_URL}/api/teams/${teamId}`);
            message.success('Team deleted successfully!');
            if (onListUpdate) onListUpdate();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to delete team.');
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
        <>
            <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
                {error && teams && teams.length > 0 && (
                    <Alert message="Error refreshing teams" description={error} type="warning" showIcon style={{ marginBottom: 16 }} />
                )}

                <List
                    grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 3, xxl: 3 }}
                    dataSource={teams || []}
                    loading={loading}
                    locale={{ emptyText: 'No teams registered yet.' }}
                    renderItem={(team) => (
                        <List.Item>
                            <Card
                                hoverable
                                title={
                                    <Space>
                                        <Avatar shape='square' size="large" src={team.logoUrl ? `${API_URL}${team.logoUrl}` : undefined} icon={<UserOutlined />} />
                                        <Text strong>{team.name}</Text>
                                    </Space>
                                }
                                actions={[
                                    <Tooltip title="Edit Team"><EditOutlined key="edit" onClick={() => handleEditClick(team)} /></Tooltip>,
                                    <Tooltip title="Delete Team">
                                        <Popconfirm
                                            key="delete"
                                            title={`Delete team "${team.name}"?`}
                                            description="Only possible if team is not in any matches."
                                            onConfirm={() => handleDeleteTeam(team._id)}
                                            okText="Yes, Delete" cancelText="No"
                                        >
                                            <DeleteOutlined key="delete" />
                                        </Popconfirm>
                                    </Tooltip>,
                                ]}
                            >
                                <List
                                    size="large"
                                    dataSource={team.players || []}
                                    renderItem={(player) => (
                                        <List.Item key={player._id} style={{ padding: '2px 0', border: 'none' }}>
                                            <List.Item.Meta
                                                avatar={<Avatar size="large" src={player.photoUrl ? `${API_URL}${player.photoUrl}` : undefined}>{!player.photoUrl ? player.name?.charAt(0).toUpperCase() : null}</Avatar>}
                                                title={<Text style={{ fontSize: '0.9em' }}>{player.name}</Text>}
                                            />
                                        </List.Item>
                                    )}
                                    locale={{ emptyText: 'No players assigned.' }}
                                    style={{ maxHeight: '350px', overflowY: 'auto' }}
                                />
                            </Card>
                        </List.Item>
                    )}
                />
            </Card>

            {editingTeam && (
                <Modal
                    title={`Edit Team: ${editingTeam.name}`}
                    open={isModalVisible}
                    onCancel={handleModalCancel}
                    footer={[
                        <Button key="back" onClick={handleModalCancel}>Cancel</Button>,
                        <Button key="submit" type="primary" loading={isSubmitting} onClick={() => editForm.submit()}>Save Changes</Button>,
                    ]}
                    destroyOnHidden
                >
                    <Form form={editForm} layout="vertical" onFinish={handleEditFinish}>
                        <Form.Item name="name" label="Team Name" rules={[{ required: true }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Team Logo (Optional)">
                            <Upload
                                listType="picture-card" fileList={logoFileList}
                                beforeUpload={() => false}
                                onChange={({ fileList: newFileList }) => setLogoFileList(newFileList)}
                                maxCount={1}
                                onRemove={() => setLogoFileList([])}
                            >
                                {logoFileList.length < 1 && <div><UploadOutlined /><div style={{ marginTop: 8 }}>Change</div></div>}
                            </Upload>
                        </Form.Item>
                        <Form.Item name="playerIds" label="Players" rules={[{ required: true, type: 'array', min: 1 }]}>
                            <Select
                                mode="multiple"
                                placeholder="Select players"
                                loading={loadingModalPlayers}
                                options={allPlayers.map(p => ({ value: p._id, label: `${p.name} (${p.category})` }))}
                            />
                        </Form.Item>
                    </Form>
                </Modal>
            )}
        </>
    );
};

export default TeamList;