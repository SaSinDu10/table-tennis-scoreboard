// src/components/TeamRelayMatchSetup.jsx
import React, { useState, useEffect } from 'react';
import { Form, Select, Button, message, Card, Typography, InputNumber, Spin, Radio } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TeamRelayMatchSetup = ({ onTeamMatchCreated }) => {
    const [form] = Form.useForm();
    const [allTeams, setAllTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    // Fetch pre-defined teams
    useEffect(() => {
        setLoadingTeams(true);
        const fetchTeams = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/teams`);
                setAllTeams(response.data || []);
            } catch (error) {
                message.error('Failed to load teams list.');
            } finally {
                setLoadingTeams(false);
            }
        };
        fetchTeams();
    }, []);

    // Handle form submission
    const handleFinish = async (values) => {
        setSubmitting(true);
        if (values.team1Id === values.team2Id) {
            message.error("Team 1 and Team 2 must be different.");
            setSubmitting(false);
            return;
        }

        const payload = {
            // category: values.category, // <<< REMOVED
            matchType: 'Team',
            teamMatchSubType: 'Relay',
            teamMatchEncounterFormat: values.encounterFormat,
            team1Id: values.team1Id,
            team2Id: values.team2Id,
            numberOfSets: values.numberOfLegs, // Re-use numberOfSets for number of legs
            setPointTarget: values.pointsPerLeg,
        };

        try {
            const response = await axios.post(`${API_URL}/api/matches`, payload);
            message.success(`Team Relay Match created successfully!`);
            form.resetFields();
            if (onTeamMatchCreated) { onTeamMatchCreated(response.data); }
            navigate(`/team-match/${response.data._id}/score`);
        } catch (error) {
            console.error("Error creating relay match:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to create relay match.');
        } finally {
            setSubmitting(false);
        }
    };

    // Helper to filter out the already selected team for the second dropdown
    const getAvailableTeams = (excludeId) => {
        if (!allTeams) return [];
        return allTeams.filter(t => t._id !== excludeId);
    };

    if (loadingTeams && allTeams.length === 0) {
        return
    }

    return (
        <Card title={<Title level={4} style={{ marginBottom: 0}}>Setup New "RELAY - Type" Team Relay Match</Title>}>
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{ numberOfLegs: 5, pointsPerLeg: 10, encounterFormat: 'Individual'}}
            >

                <Form.Item name="team1Id" label="Select Team 1" rules={[{ required: true, message: 'Please select Team 1!' }]}>
                    <Select
                        placeholder="Choose Team 1"
                        showSearch
                        optionFilterProp="children"
                        loading={loadingTeams}
                        onChange={() => {
                            // Reset Team 2 if the new Team 1 is the same as the old Team 2
                            const team1Value = form.getFieldValue('team1Id');
                            const team2Value = form.getFieldValue('team2Id');
                            if (team1Value && team1Value === team2Value) {
                                form.setFieldsValue({ team2Id: undefined });
                            }
                        }}
                    >
                        {allTeams.map(team => <Option key={team._id} value={team._id}>{team.name}</Option>)}
                    </Select>
                </Form.Item>

                {/* --- FIX: WRAP TEAM 2 SELECT IN Form.Item shouldUpdate --- */}
                <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) => prevValues.team1Id !== currentValues.team1Id}
                >
                    {({ getFieldValue }) => (
                        <Form.Item
                            name="team2Id"
                            label="Select Team 2"
                            rules={[{ required: true, message: 'Please select Team 2!' }]}
                        >
                            <Select
                                placeholder="Choose Team 2"
                                showSearch
                                optionFilterProp="children"
                                loading={loadingTeams}
                                disabled={!getFieldValue('team1Id')} // Disable until Team 1 is selected
                            >
                                {getAvailableTeams(getFieldValue('team1Id')).map(team => (
                                    <Option key={team._id} value={team._id}>{team.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}
                </Form.Item>
                {/* -------------------------------------------------------- */}

                <Form.Item name="encounterFormat" label="Encounter Format (for each leg)" rules={[{ required: true }]}>
                    <Radio.Group>
                        <Radio value="Individual">1 vs 1 (Singles)</Radio>
                        <Radio value="Dual">2 vs 2 (Doubles)</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item name="numberOfLegs" label="Number of Legs in Match" rules={[{ required: true }]}>
                    <InputNumber min={1} max={10} style={{ width: '100px' }} />
                </Form.Item>

                <Form.Item name="pointsPerLeg" label="Points Per Leg" rules={[{ required: true }]}>
                    <InputNumber min={5} max={50} style={{ width: '100px' }} />
                </Form.Item>

                <Form.Item style={{ marginTop: 24 }}>
                    <Button type="primary" htmlType="submit" loading={submitting} block>
                        Create Relay Match & Proceed
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default TeamRelayMatchSetup;