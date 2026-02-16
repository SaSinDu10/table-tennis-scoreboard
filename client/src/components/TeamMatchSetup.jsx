// src/components/TeamMatchSetup.jsx
import React, { useState, useEffect } from 'react';
import { Form, Select, Button, message, Card, Typography, Spin } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TeamMatchSetup = ({ onTeamMatchCreated }) => {
    const [form] = Form.useForm();
    const [allTeams, setAllTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    // Fetch pre-defined teams
    useEffect(() => { /* ... same as before ... */ }, []);

    const handleFinish = async (values) => {
        setSubmitting(true);
        if (values.team1Id === values.team2Id) {
            message.error("Teams must be different.");
            setSubmitting(false);
            return;
        }

        const payload = {
            matchType: 'Team', // Set the new type
            team1Id: values.team1Id,
            team2Id: values.team2Id,
            category: values.category,
        };

        try {
            const response = await axios.post(`${API_URL}/api/matches`, payload);
            message.success(`Team Match created!`);
            form.resetFields();
            if (onTeamMatchCreated) { onTeamMatchCreated(response.data); }
            // Navigate to the new scoreboard
            navigate(`/team-match/${response.data._id}/score`);
        } catch (error) { /* ... error handling ... */ }
        finally { setSubmitting(false); }
    };

    // ... (getAvailableTeams helper) ...

    if (loadingTeams) { return <Card><Spin /></Card>; }

    return (
        <Card title={<Title level={2}>Setup New Team Match</Title>} style={{ textAlign: 'center'}}>
            <Form form={form} layout="vertical" onFinish={handleFinish}>
                <Form.Item name="category" label="Match Category" rules={[{ required: true }]}>
                    <Select placeholder="Select category">
                        <Option value="Super Senior">Super Senior</Option>
                        <Option value="Senior">Senior</Option>
                        <Option value="Junior">Junior</Option>
                    </Select>
                </Form.Item>

                <Form.Item name="team1Id" label="Select Team 1" rules={[{ required: true }]}>
                    {/* ... Select for Team 1, populated from /api/teams ... */}
                </Form.Item>

                <Form.Item name="team2Id" label="Select Team 2" rules={[{ required: true }]} dependencies={['team1Id']}>
                    {/* ... Select for Team 2, filtered to exclude Team 1 ... */}
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={submitting} block>
                        Create Team Match & Proceed to Setup
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default TeamMatchSetup;