// src/components/TeamSetMatchSetup.jsx
import React, { useState, useEffect } from 'react';
import { Form, Select, Button, message, Card, Typography, InputNumber, Spin, Radio } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TeamSetMatchSetup = ({ onTeamMatchCreated }) => {
    const [form] = Form.useForm();
    const [allTeams, setAllTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setLoadingTeams(true);
        const fetchTeams = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/teams`);
                setAllTeams(response.data || []);
            } catch (error) {
                message.error('Failed to load teams list.');
                console.error("Error fetching teams:", error);
                setAllTeams([]);
            } finally {
                setLoadingTeams(false);
            }
        };
        fetchTeams();
    }, []);

    const handleFinish = async (values) => {
        setSubmitting(true);
        console.log("Submitting Team Match data:", values);

        if (values.team1Id === values.team2Id) {
            message.error("Team 1 and Team 2 must be different.");
            setSubmitting(false);
            return;
        }

        const payload = {
            matchType: 'Team',
            teamMatchSubType: 'Set',
            teamMatchEncounterFormat: values.encounterFormat,
            team1Id: values.team1Id,
            team2Id: values.team2Id,
            numberOfSets: values.numberOfSets,
            maxSetsPerPlayer: values.maxSetsPerPlayer
        };

        console.log("Submitting Team SET Match payload:", payload);

        try {
            const response = await axios.post(`${API_URL}/api/matches`, payload);
            message.success(`Team Set Match created successfully!`);
            form.resetFields();
            if (onTeamMatchCreated) { onTeamMatchCreated(response.data); }
            navigate(`/team-match/${response.data._id}/score`);
        } catch (error) {
            console.error("Error creating team set match:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to create team set match.');
        } finally {
            setSubmitting(false);
        }
    };

    const getAvailableTeams = (excludeId) => {
        return allTeams.filter(t => t._id !== excludeId);
    };

    if (loadingTeams && allTeams.length === 0) {
        return <Card title={<Title level={4}>Setup New Team Set Match</Title>}><Spin /></Card>;
    }

    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>Setup New Team Match</Title>}>
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{ numberOfSets: 7, encounterFormat: 'Dual', maxSetsPerPlayer: 2 }}
            >

                <Form.Item
                    name="team1Id"
                    label="Select Team 1"
                    rules={[{ required: true, message: 'Please select Team 1!' }]}
                >
                    <Select
                        placeholder="Choose Team 1"
                        loading={loadingTeams}
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={allTeams.map(team => ({
                            value: team._id,
                            label: team.name
                        }))}
                        onChange={() => {
                            const team1Value = form.getFieldValue('team1Id');
                            const team2Value = form.getFieldValue('team2Id');
                            if (team1Value && team1Value === team2Value) {
                                form.setFieldsValue({ team2Id: undefined });
                            }
                        }}
                    />
                </Form.Item>

                <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) => prevValues.team1Id !== currentValues.team1Id}
                >
                    {({ getFieldValue }) => {
                        const team1SelectedId = getFieldValue('team1Id');
                        return (
                            <Form.Item
                                name="team2Id"
                                label="Select Team 2"
                                rules={[{ required: true, message: 'Please select Team 2!' }]}
                            >
                                <Select
                                    placeholder="Choose Team 2"
                                    loading={loadingTeams}
                                    showSearch
                                    optionFilterProp="children"
                                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                    options={getAvailableTeams(team1SelectedId).map(team => ({
                                        value: team._id,
                                        label: team.name
                                    }))}
                                    disabled={!team1SelectedId && allTeams.length > 0}
                                />
                            </Form.Item>
                        );
                    }}
                </Form.Item>

                <Form.Item
                    name="encounterFormat"
                    label="Encounter Format (for each set)"
                    rules={[{ required: true, message: 'Please select the encounter format!' }]}
                >
                    <Radio.Group>
                        <Radio value="Individual">1 vs 1 (Singles)</Radio>
                        <Radio value="Dual">2 vs 2 (Doubles)</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item
                    name="maxSetsPerPlayer"
                    label="Max Sets Per Player"
                    rules={[{ required: true, message: 'Please enter max sets per player!' }]}
                    tooltip="The maximum number of sets any single player can participate in during this match."
                >
                    <InputNumber min={1} max={5} style={{ width: '100px' }} />
                </Form.Item>

                <Form.Item
                    name="numberOfSets"
                    label="Number of Sets in Match"
                    rules={[{ required: true, message: 'Please enter the number of sets!' }]}
                >
                    <InputNumber min={1} max={9} style={{ width: '100px' }} />
                </Form.Item>

                <Form.Item style={{ marginTop: 24 }}>
                    <Button type="primary" htmlType="submit" loading={submitting} block>
                        Create & Proceed to Pair Selection
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default TeamSetMatchSetup;