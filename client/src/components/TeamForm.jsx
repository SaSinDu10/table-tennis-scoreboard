// src/components/TeamForm.jsx
import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, Card, Typography, Spin } from 'antd';
import axios from 'axios';

const { Option } = Select;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EXPECTED_TEAM_SIZE = 6; // Define expected team size, adjust if needed

const TeamForm = ({ onTeamCreated }) => {
    const [form] = Form.useForm();
    const [allPlayers, setAllPlayers] = useState([]); // To populate player select dropdown
    const [loadingPlayers, setLoadingPlayers] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch all players to select from
    useEffect(() => {
        const fetchPlayers = async () => {
            setLoadingPlayers(true);
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

        // Validate player selection count (client-side, backend also validates)
        if (!values.playerIds || values.playerIds.length !== EXPECTED_TEAM_SIZE) {
            message.error(`Please select exactly ${EXPECTED_TEAM_SIZE} players for the team.`);
            setSubmitting(false);
            return;
        }

        const payload = {
            name: values.name,
            playerIds: values.playerIds
        };

        try {
            const response = await axios.post(`${API_URL}/api/teams`, payload);
            message.success(`Team '${response.data.name}' created successfully!`);
            form.resetFields(); // Clear the form
            if (onTeamCreated) {
                onTeamCreated(response.data); // Callback to parent (e.g., App.jsx to refresh list)
            }
        } catch (error) {
            console.error("Error creating team:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to create team.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>Create New Team</Title>}>
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
            >
                <Form.Item
                    name="name"
                    label="Team Name"
                    rules={[{ required: true, message: 'Please input the team name!' }]}
                >
                    <Input placeholder="Enter team name" />
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
                        mode="multiple" // Allow multiple player selections
                        placeholder={`Select ${EXPECTED_TEAM_SIZE} players for the team`}
                        loading={loadingPlayers}
                        allowClear
                        showSearch
                        optionFilterProp="children" // Search by displayed text
                        filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        // Use options prop for better performance with many players
                        options={allPlayers.map(player => ({
                            value: player._id,
                            label: `${player.name} (${player.category})`
                        }))}
                        // AntD Form validation for max count is better handled by rules
                        // maxCount={EXPECTED_TEAM_SIZE} // This prop is for UI limit, not form validation
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