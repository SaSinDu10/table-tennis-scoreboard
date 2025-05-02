// src/components/MatchSetupForm.jsx
import React, { useState, useEffect } from 'react';
import { Form, Select, Button, message, Card, Typography, Radio, Spin } from 'antd';
import axios from 'axios';

const { Option } = Select;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MatchSetupForm = ({ onMatchCreated }) => {
    const [form] = Form.useForm();
    const [players, setPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [matchType, setMatchType] = useState('Individual'); // Default

    // Fetch players on component mount
    useEffect(() => {
        const fetchPlayers = async () => {
            setLoadingPlayers(true);
            try {
                const response = await axios.get(`${API_URL}/api/players`);
                setPlayers(response.data || []);
            } catch (error) {
                message.error('Failed to load players list.');
                console.error("Error fetching players:", error);
            } finally {
                setLoadingPlayers(false);
            }
        };
        fetchPlayers();
    }, []);

    const handleFinish = async (values) => {
        setSubmitting(true);
        // Prepare payload, sending 'bestOf' value directly
        const payload = {
            category: values.category,
            matchType: values.matchType,
            player1Id: values.player1Id,
            player2Id: values.player2Id,
            player3Id: values.matchType === 'Dual' ? values.player3Id : null,
            player4Id: values.matchType === 'Dual' ? values.player4Id : null,
            bestOf: values.bestOf // Send the selected 'Best of' value (1, 3, or 5)
        };

        // Basic validation: Ensure players are distinct
        const selectedIds = [payload.player1Id, payload.player2Id, payload.player3Id, payload.player4Id].filter(Boolean);
        if (new Set(selectedIds).size !== selectedIds.length) {
            message.error('Players selected must be distinct.');
            setSubmitting(false);
            return;
        }

        try {
            // POST using the payload including 'bestOf'
            const response = await axios.post(`${API_URL}/api/matches`, payload);
            message.success(`Match created successfully! (${response.data._id})`);
            form.resetFields();
            // Reset form defaults after successful submission
            setMatchType('Individual');
            form.setFieldsValue({ matchType: 'Individual', bestOf: 5 }); // Reset radios
            if (onMatchCreated) {
                onMatchCreated(response.data); // Pass newly created match data back
            }
        } catch (error) {
            console.error("Error creating match:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to create match.');
        } finally {
            setSubmitting(false);
        }
    };

    // Filter out selected players for subsequent dropdowns
    const getAvailablePlayers = (...excludeIds) => {
        return players.filter(p => !excludeIds.includes(p._id));
    };

    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>Setup New Match</Title>}>
            {loadingPlayers ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin tip="Loading Players..." />
                </div>
            ) : (
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    initialValues={{ matchType: 'Individual', bestOf: 1 }} // Default values
                >
                    {/* Category Selection */}
                    <Form.Item
                        name="category"
                        label="Category"
                        rules={[{ required: true, message: 'Please select category!' }]}
                    >
                        <Select placeholder="Select match category">
                            <Option value="Super Senior">Super Senior</Option>
                            <Option value="Senior">Senior</Option>
                            <Option value="Junior">Junior</Option>
                        </Select>
                    </Form.Item>

                    {/* Match Type Selection */}
                    <Form.Item
                        name="matchType"
                        label="Match Type"
                        rules={[{ required: true }]}
                    >
                        <Radio.Group onChange={(e) => setMatchType(e.target.value)}>
                            <Radio value="Individual">Individual</Radio>
                            <Radio value="Dual">Dual (Doubles)</Radio>
                        </Radio.Group>
                    </Form.Item>

                    {/* Match Length Selection */}
                    <Form.Item
                        name="bestOf" // Name corresponds to value sent (1, 3, 5)
                        label="Match Length"
                        rules={[{ required: true }]}
                    >
                        <Radio.Group>
                            <Radio value={1}>Best of 1</Radio> {/* Added Best of 1 */}
                            <Radio value={3}>Best of 3</Radio>
                            <Radio value={5}>Best of 5</Radio>
                        </Radio.Group>
                    </Form.Item>

                    {/* Player Selection Logic (uses Form.Item.shouldUpdate) */}
                    <Form.Item shouldUpdate noStyle>
                        {({ getFieldValue }) => {
                            // Get currently selected player IDs to filter options
                            const p1 = getFieldValue('player1Id');
                            const p2 = getFieldValue('player2Id');
                            const p3 = getFieldValue('player3Id');
                            const p4 = getFieldValue('player4Id'); // Needed for filtering

                            return (
                                <>
                                    <Title level={5} style={{ marginTop: 10 }}>Team 1</Title>
                                    {/* Player 1 (T1P1 for Dual, P1 for Individual) */}
                                    <Form.Item
                                        name="player1Id"
                                        label={matchType === 'Individual' ? "Player 1" : "Team 1 - Player 1"}
                                        rules={[{ required: true, message: 'Select Player 1!' }]}
                                    >
                                        <Select placeholder="Select Player 1" showSearch optionFilterProp="children">
                                            {getAvailablePlayers(p2, p3, p4).map(p => <Option key={p._id} value={p._id}>{p.name} ({p.category})</Option>)}
                                        </Select>
                                    </Form.Item>

                                    {/* Player 2 for Team 1 (Only for Dual) */}
                                    {matchType === 'Dual' && (
                                        <Form.Item
                                            name="player2Id"
                                            label="Team 1 - Player 2"
                                            rules={[{ required: true, message: 'Select Team 1 Player 2!' }]}
                                        >
                                            <Select placeholder="Select Team 1 Player 2" showSearch optionFilterProp="children">
                                                {getAvailablePlayers(p1, p3, p4).map(p => <Option key={p._id} value={p._id}>{p.name} ({p.category})</Option>)}
                                            </Select>
                                        </Form.Item>
                                    )}

                                    <Title level={5} style={{ marginTop: 10 }}>Team 2</Title>
                                    {/* Player 2 (Only for Individual) */}
                                    {matchType === 'Individual' && (
                                        <Form.Item
                                            name="player2Id"
                                            label="Player 2"
                                            rules={[{ required: true, message: 'Select Player 2!' }]}
                                        >
                                            <Select placeholder="Select Player 2" showSearch optionFilterProp="children">
                                                {getAvailablePlayers(p1).map(p => <Option key={p._id} value={p._id}>{p.name} ({p.category})</Option>)}
                                            </Select>
                                        </Form.Item>
                                    )}

                                    {/* Team 2 Players (Only for Dual) */}
                                    {matchType === 'Dual' && (
                                        <>
                                            {/* Player 1 for Team 2 */}
                                            <Form.Item
                                                name="player3Id"
                                                label="Team 2 - Player 1"
                                                rules={[{ required: true, message: 'Select Team 2 Player 1!' }]}
                                            >
                                                <Select placeholder="Select Team 2 Player 1" showSearch optionFilterProp="children">
                                                    {getAvailablePlayers(p1, p2, p4).map(p => <Option key={p._id} value={p._id}>{p.name} ({p.category})</Option>)}
                                                </Select>
                                            </Form.Item>
                                            {/* Player 2 for Team 2 */}
                                            <Form.Item
                                                name="player4Id"
                                                label="Team 2 - Player 2"
                                                rules={[{ required: true, message: 'Select Team 2 Player 2!' }]}
                                            >
                                                <Select placeholder="Select Team 2 Player 2" showSearch optionFilterProp="children">
                                                    {getAvailablePlayers(p1, p2, p3).map(p => <Option key={p._id} value={p._id}>{p.name} ({p.category})</Option>)}
                                                </Select>
                                            </Form.Item>
                                        </>
                                    )}
                                </>
                            );
                        }}
                    </Form.Item>

                    {/* Submit Button */}
                    <Form.Item style={{ marginTop: 24 }}>
                        <Button type="primary" htmlType="submit" loading={submitting} block>
                            Create Match
                        </Button>
                    </Form.Item>
                </Form>
            )}
        </Card>
    );
};

export default MatchSetupForm;