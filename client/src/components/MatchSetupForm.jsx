// src/components/MatchSetupForm.jsx
import React, { useState, useEffect } from 'react';
import { Form, Select, Button, message, Card, Typography, Radio, Spin, Alert } from 'antd';
import axios from 'axios';

const { Option } = Select;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MatchSetupForm = ({ onMatchCreated }) => {
    const [form] = Form.useForm();
    const [players, setPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [matchType, setMatchType] = useState('Individual');

    useEffect(() => {
        // Set loading to true inside useEffect
        setLoadingPlayers(true);
        const fetchPlayers = async () => {
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

    // --- The payload construction was incorrect and caused conflicts ---
    const handleFinish = async (values) => {
        setSubmitting(true);
        console.log("Submitting Ind/Dual Match data:", values);

        const payload = {
            category: values.category,
            matchType: values.matchType,
            bestOf: values.bestOf,
            player1Id: values.player1Id,
            player2Id: values.matchType === 'Individual' ? values.player2Id_individual : values.player2Id_dual,
            player3Id: values.matchType === 'Dual' ? values.player3Id : null,
            player4Id: values.matchType === 'Dual' ? values.player4Id : null
        };

        console.log("Final Payload being sent:", payload);

        const selectedIds = [payload.player1Id, payload.player2Id, payload.player3Id, payload.player4Id].filter(Boolean);
        if (new Set(selectedIds).size !== selectedIds.length) {
            message.error('Players must be distinct.');
            setSubmitting(false);
            return;
        }

        try {
            const response = await axios.post(`${API_URL}/api/matches`, payload);
            message.success(`Match created successfully!`);
            form.resetFields();
            setMatchType('Individual');
            form.setFieldsValue({ matchType: 'Individual', bestOf: 1 });
            if (onMatchCreated) {
                onMatchCreated(response.data);
            }
        } catch (error) {
            console.error("Error creating match:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to create match.');
        } finally {
            setSubmitting(false);
        }
    };

    // --- A new helper function that filters by category AND excludes IDs ---
    const getAvailablePlayers = (category, excludeIds = []) => {
        if (!players || !category) return [];
        return players.filter(p => p.category === category && !excludeIds.includes(p._id));
    };

    // --- Handler to clear player selections when category changes ---
    const onCategoryChange = () => {
        form.setFieldsValue({
            player1Id: undefined,
            player2Id_individual: undefined,
            player2Id_dual: undefined,
            player3Id: undefined,
            player4Id: undefined
        });
    };

    // --- Handler to clear player selections when match type changes ---
    const onMatchTypeChange = (e) => {
        const newType = e.target.value;
        setMatchType(newType);
        form.setFieldsValue({
            player1Id: undefined,
            player2Id_individual: undefined,
            player2Id_dual: undefined,
            player3Id: undefined,
            player4Id: undefined
        });
    };

    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>Setup New Match</Title>}>
            {loadingPlayers && players.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin tip="Loading Players..." />
                </div>
            ) : (
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    initialValues={{ matchType: 'Individual', bestOf: 1 }}
                >
                    <Form.Item
                        name="category"
                        label="Category"
                        rules={[{ required: true, message: 'Please select category first!' }]}
                    >

                        <Select placeholder="Select match category" onChange={onCategoryChange} allowClear>
                            <Option value="Super Senior">Super Senior</Option>
                            <Option value="Senior">Senior</Option>
                            <Option value="Junior">Junior</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="matchType"
                        label="Match Type"
                        rules={[{ required: true }]}
                    >
                        {/* --- onChange handler to the match type Radio.Group --- */}
                        <Radio.Group onChange={onMatchTypeChange}>
                            <Radio value="Individual">Individual</Radio>
                            <Radio value="Dual">Dual (Doubles)</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item name="bestOf" label="Match Length" rules={[{ required: true }]}>
                        <Radio.Group>
                            <Radio value={1}>Best of 1</Radio>
                            <Radio value={3}>Best of 3</Radio>
                            <Radio value={5}>Best of 5</Radio>
                        </Radio.Group>
                    </Form.Item>

                    {/* --- Wrap player selection in a new dependency wrapper --- */}
                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.category !== currentValues.category}
                    >
                        {({ getFieldValue }) => {
                            const selectedCategory = getFieldValue('category');

                            if (!selectedCategory) {
                                return <Alert message="Please select a category to see available players." type="info" />;
                            }

                            const p1 = getFieldValue('player1Id');
                            const p2_ind = getFieldValue('player2Id_individual');
                            const p2_dual = getFieldValue('player2Id_dual');
                            const p3 = getFieldValue('player3Id');
                            const p4 = getFieldValue('player4Id');

                            return (
                                <>
                                    {matchType === 'Individual' ? (
                                        <>
                                            <Form.Item name="player1Id" label="Player 1" rules={[{ required: true }]}>
                                                <Select placeholder="Select Player 1" showSearch optionFilterProp="children" allowClear>
                                                    {getAvailablePlayers(selectedCategory, [p2_ind]).map(p => <Option key={p._id} value={p._id}>{p.name}</Option>)}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item name="player2Id_individual" label="Player 2" rules={[{ required: true }]}>
                                                <Select placeholder="Select Player 2" showSearch optionFilterProp="children" allowClear>
                                                    {getAvailablePlayers(selectedCategory, [p1]).map(p => <Option key={p._id} value={p._id}>{p.name}</Option>)}
                                                </Select>
                                            </Form.Item>
                                        </>
                                    ) : ( // Dual Match
                                        <>
                                            <Title level={5} style={{ marginTop: 10 }}>Team 1</Title>
                                            <Form.Item name="player1Id" label="Team 1 - Player 1" rules={[{ required: true }]}>
                                                <Select placeholder="Select Player" showSearch optionFilterProp="children" allowClear>
                                                    {getAvailablePlayers(selectedCategory, [p2_dual, p3, p4]).map(p => <Option key={p._id} value={p._id}>{p.name}</Option>)}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item name="player2Id_dual" label="Team 1 - Player 2" rules={[{ required: true }]}>
                                                <Select placeholder="Select Player" showSearch optionFilterProp="children" allowClear>
                                                    {getAvailablePlayers(selectedCategory, [p1, p3, p4]).map(p => <Option key={p._id} value={p._id}>{p.name}</Option>)}
                                                </Select>
                                            </Form.Item>

                                            <Title level={5} style={{ marginTop: 10 }}>Team 2</Title>
                                            <Form.Item name="player3Id" label="Team 2 - Player 1" rules={[{ required: true }]}>
                                                <Select placeholder="Select Player" showSearch optionFilterProp="children" allowClear>
                                                    {getAvailablePlayers(selectedCategory, [p1, p2_dual, p4]).map(p => <Option key={p._id} value={p._id}>{p.name}</Option>)}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item name="player4Id" label="Team 2 - Player 2" rules={[{ required: true }]}>
                                                <Select placeholder="Select Player" showSearch optionFilterProp="children" allowClear>
                                                    {getAvailablePlayers(selectedCategory, [p1, p2_dual, p3]).map(p => <Option key={p._id} value={p._id}>{p.name}</Option>)}
                                                </Select>
                                            </Form.Item>
                                        </>
                                    )}
                                </>
                            );
                        }}
                    </Form.Item>

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