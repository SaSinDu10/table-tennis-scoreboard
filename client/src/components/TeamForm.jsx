// src/components/TeamForm.jsx

import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, Card, Typography, Spin, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EXPECTED_TEAM_SIZE = 7;

const TeamForm = ({ onTeamCreated }) => {
    const [form] = Form.useForm();
    const [allPlayers, setAllPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [logoFileList, setLogoFileList] = useState([]);

    useEffect(() => {
        setLoadingPlayers(true);
        const fetchPlayers = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/players`);
                setAllPlayers(response.data || []);
            } catch (error) {
                message.error('Failed to load players for team selection.');
                console.error("Error fetching players:", error);
            } finally {
                setLoadingPlayers(false);
            }
        };
        fetchPlayers();
    }, []);

    const handleFinish = async (values) => {
        setSubmitting(true);
        console.log("Submitting team data:", values);

        if (!values.playerIds || values.playerIds.length !== EXPECTED_TEAM_SIZE) {
            message.error(`Please select exactly ${EXPECTED_TEAM_SIZE} players.`);
            setSubmitting(false);
            return;
        }

        const formData = new FormData();
        formData.append('name', values.name);
        (values.playerIds || []).forEach(playerId => {
            formData.append('playerIds', playerId);
        });

        if (logoFileList.length > 0 && logoFileList[0].originFileObj) {
            formData.append('teamLogo', logoFileList[0].originFileObj);
        }

        try {
            const response = await axios.post(`${API_URL}/api/teams`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            message.success(`Team '${response.data.name}' created successfully!`);
            form.resetFields();
            setLogoFileList([]);
            if (onTeamCreated) {
                onTeamCreated(response.data);
            }
        } catch (error) {
            console.error("Error creating team:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to create team.');
        } finally {
            setSubmitting(false);
        }
    };

    // Handlers for logo upload component
    const handleLogoUploadChange = ({ fileList: newFileList }) => {
        setLogoFileList(newFileList.slice(-1));
    };

    const beforeLogoUpload = (file) => {
        const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/gif';
        if (!isJpgOrPng) { message.error('You can only upload JPG/PNG/GIF file!'); }
        const isLt1M = file.size / 1024 / 1024 < 1;
        if (!isLt1M) { message.error('Image must be smaller than 1MB!'); }
        return false;
    };


    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>Create New Team</Title>}>
            <Form form={form} layout="vertical" onFinish={handleFinish}>
                <Form.Item
                    name="name"
                    label="Team Name"
                    rules={[{ required: true, message: 'Please input the team name!' }]}
                >
                    <Input placeholder="Enter team name" />
                </Form.Item>

                <Form.Item label="Team Logo (Optional)">
                    <Upload
                        listType="picture-card"
                        fileList={logoFileList}
                        beforeUpload={beforeLogoUpload}
                        onChange={handleLogoUploadChange}
                        onRemove={() => setLogoFileList([])}
                        maxCount={1}
                        accept=".jpg,.jpeg,.png,.gif"
                    >
                        {logoFileList.length < 1 && (
                            <div>
                                <UploadOutlined />
                                <div style={{ marginTop: 8 }}>Upload</div>
                            </div>
                        )}
                    </Upload>
                </Form.Item>

                <Form.Item
                    name="playerIds"
                    label={`Select ${EXPECTED_TEAM_SIZE} Players`}
                    rules={[
                        { required: true, message: `Please select ${EXPECTED_TEAM_SIZE} players!` },
                        { type: 'array', min: EXPECTED_TEAM_SIZE, max: EXPECTED_TEAM_SIZE, message: `Must select exactly ${EXPECTED_TEAM_SIZE} players.` }
                    ]}
                >
                    <Select
                        mode="multiple"
                        placeholder={`Select ${EXPECTED_TEAM_SIZE} players`}
                        loading={loadingPlayers}
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={allPlayers.map(player => ({
                            value: player._id,
                            label: `${player.name} (${player.category})`
                        }))}
                    />
                </Form.Item>

                <Form.Item style={{ marginTop: 24 }}>
                    <Button type="primary" htmlType="submit" loading={submitting} block>
                        {submitting ? 'Creating Team...' : 'Create Team'}
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default TeamForm;