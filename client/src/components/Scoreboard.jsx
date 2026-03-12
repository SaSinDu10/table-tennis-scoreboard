// src/components/Scoreboard.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Typography, Spin, Alert, Card, Row, Col, Button, Statistic,
    Divider, List, Tag, message, Avatar, Space, Tooltip, Result, Form, Radio, Select, Modal
} from 'antd';
import { PlusOutlined, ArrowLeftOutlined, UserOutlined, UndoOutlined, TrophyOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const formatBestOf = (setsToWin) => {
    if (setsToWin === 1) return 'Best of 1';
    if (setsToWin === 2) return 'Best of 3';
    if (setsToWin === 3) return 'Best of 5';
    return `Win ${setsToWin} Sets`;
};

const Scoreboard = () => {
    const { id: matchId } = useParams();
    const navigate = useNavigate();
    const [matchData, setMatchData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdatingScore, setIsUpdatingScore] = useState(false);
    const [isUndoing, setIsUndoing] = useState(false);
    const [isStartingMatch, setIsStartingMatch] = useState(false);
    const [startForm] = Form.useForm();
    const [nextSetForm] = Form.useForm();
    const selectedServingTeam = Form.useWatch('initialServer', startForm);
    const selectedNextServingTeam = Form.useWatch('initialServerTeam', nextSetForm);
    const [isNextSetModalVisible, setIsNextSetModalVisible] = useState(false);

    useEffect(() => {
        if (!matchId) return;
        let isMounted = true;
        const fetchMatch = async () => {
            setLoading(true); setError(null);
            try {
                const response = await axios.get(`${API_URL}/api/matches/${matchId}`);
                if (isMounted) {
                    const match = response.data;
                    setMatchData(match);

                    if (match.status === 'AwaitingSubMatchSetup') {
                        setIsNextSetModalVisible(true);
                    }
                }
            } catch (err) {
                setError(err.response?.data?.message || "Failed to load match data.");
            } finally { if (isMounted) setLoading(false); }
        };
        fetchMatch();
        return () => { isMounted = false; };
    }, [matchId]);

    // --- Handlers ---
    const handleScoreUpdate = async (scoringTeam) => {
        if (isUpdatingScore || matchData?.status !== 'Live' || isUndoing) return;
        setIsUpdatingScore(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/score`, { scoringTeam });
            setMatchData(response.data);
            if (response.data.status === 'Finished') {
                message.success(`Match finished!`);
            }
        } catch (err) {
            message.error(err.response?.data?.message || "Failed to update score.");
        } finally {
            setIsUpdatingScore(false);
        }
    };

    const handleUndo = async () => {
        if (isUndoing || isUpdatingScore || matchData?.status !== 'Live' || !matchData?.pointHistory?.length) return;
        setIsUndoing(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/undo`);
            setMatchData(response.data);
            message.success('Last point undone.');
        } catch (err) {
            message.error(err.response?.data?.message || "Failed to undo point.");
        } finally {
            setIsUndoing(false);
        }
    };

    const handleNextSetSetup = async (values) => {
        setIsStartingMatch(true);
        try {
            const payload = matchType === 'Individual'
                ? { initialServer: values.initialServer }
                : {
                    initialServerPlayerId: values.initialServerPlayerId,
                    initialReceiverPlayerId: values.initialReceiverPlayerId
                };

            const response = await axios.put(`${API_URL}/api/matches/${matchId}/next-set-server`, payload);

            setMatchData(response.data);
            setIsNextSetModalVisible(false);
            nextSetForm.resetFields();
            message.success('Next set started!');
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to start next set.');
        } finally {
            setIsStartingMatch(false);
        }
    };

    const handleStartMatch = async (values) => {
        if (isStartingMatch || matchData?.status !== 'Upcoming') return;
        setIsStartingMatch(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/start`, values);
            setMatchData(response.data);
            message.success(`Match started!`);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to start match.");
        } finally {
            setIsStartingMatch(false);
        }
    };

    const handleStartIndividualMatch = (serverChoice) => { handleStartMatch({ initialServer: serverChoice }); };

    if (loading) { return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>; }
    if (error) { return <div style={{ padding: 20 }}><Alert message="Error" description={error} type="error" showIcon /></div>; }
    if (!matchData) { return <div style={{ padding: 20 }}><Alert message="Match data not found." type="warning" showIcon /></div>; }

    const { status, matchType, category, player1, player2, player3, player4, score, setsToWin, winner } = matchData;
    const isFinished = status === 'Finished';
    const isAwaitingNextSet = status === 'AwaitingSubMatchSetup';
    const isUpcoming = status === 'Upcoming';
    const isLive = status === 'Live';
    const canUndo = isLive && matchData.pointHistory?.length > 0;
    const team1Name = matchType === 'Dual' ? `${player1?.name || 'P1'} & ${player2?.name || 'P2'}` : player1?.name;
    const team2Name = matchType === 'Dual' ? `${player3?.name || 'P3'} & ${player4?.name || 'P4'}` : player2?.name;
    const currentPlayerServerId = matchData?.score?.currentPlayerServer?._id;
    const currentPlayerReceiverId = matchData?.score?.currentPlayerReceiver?._id;

    // --- THE WINNER LOGIC ---
    let winnerName = 'N/A';
    let winnerPlayers = [];
    if (isFinished && winner) {
        console.log("--- DEBUGGING WINNER ---");
        console.log("Match Type:", matchType);
        console.log("Winner from DB (winner):", winner);
        console.log("Player 1 Object:", player1);
        console.log("Player 2 Object:", player2);
        console.log("Is winner === player1._id?", winner?.toString() === player1?._id?.toString());
        console.log("Is winner === player2._id?", winner?.toString() === player2?._id?.toString());

        if (isFinished && winner) {
            if (matchType === 'Individual') {
                if (winner && winner._id) {
                    winnerName = winner.name;
                    winnerPlayers = [winner];
                }
            } else if (matchType === 'Dual') {
                if (winner === 1) {
                    winnerName = team1Name;
                    winnerPlayers = [player1, player2].filter(Boolean);
                } else {
                    winnerName = team2Name;
                    winnerPlayers = [player3, player4].filter(Boolean);
                }
            }
            console.log("Final determined winnerName:", winnerName);
            console.log("------------------------");
        }
    }

    // --- Avatar Rendering Helper Function ---
    const renderAvatars = (players, side = 'left') => {
        const avatarSize = 80;
        const avatarContent = (p) => {
            if (!p) return null;

            let isServing = false;
            let isReceiving = false;

            if (isLive) {
                if (matchType === 'Dual') {
                    isServing = p._id === currentPlayerServerId;
                    isReceiving = p._id === currentPlayerReceiverId;
                } else { // Individual match
                    isServing = (side === 'left' && score.server === 1) || (side === 'right' && score.server === 2);
                }
            }

            const avatar = (
                <Avatar key={p._id} size={avatarSize} src={p.photoUrl ? `${API_URL}${p.photoUrl}` : undefined}>
                    {!p.photoUrl ? p.name?.charAt(0) : null}
                </Avatar>
            );

            if (isServing) {
                return <Tooltip title="Serving">
                    <span style={{
                        border: '3px solid #1677ff', borderRadius: '50%',
                        display: 'inline-block', padding: '3px', lineHeight: 0
                    }}>
                        {avatar}
                    </span>
                </Tooltip>;
            }
            if (isReceiving) {
                return <Tooltip title="Receiving">
                    <span style={{
                        border: '3px solid #faad14', borderRadius: '50%',
                        display: 'inline-block', padding: '3px', lineHeight: 0
                    }}>
                        {avatar}
                    </span>
                </Tooltip>;
            }
            return avatar;
        };

        if (!players || players.length === 0) return <Avatar size={avatarSize} icon={<UserOutlined />} />;
        if (players.length === 1) return avatarContent(players[0]);

        const containerWidth = avatarSize + 40;
        return (
            <Space direction="vertical" size={4}>
                <div style={{ width: containerWidth, display: 'flex', justifyContent: side === 'left' ? 'flex-start' : 'flex-end' }}>{avatarContent(players[0])}</div>
                <div style={{ width: containerWidth, display: 'flex', justifyContent: side === 'left' ? 'flex-end' : 'flex-start' }}>{avatarContent(players[1])}</div>
            </Space>
        );
    };

    if (isUpcoming) {
        if (matchType === 'Individual') {
            return (
                <Card>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')} style={{ marginBottom: 16 }}>Back to Matches</Button>
                    <Title level={3} style={{ textAlign: 'center' }}>Start Match</Title>
                    <div style={{ textAlign: 'center', margin: '30px 0' }}>
                        <Title level={5}>Who serves first?</Title>
                        <Space direction="vertical" size="large" style={{ marginTop: 20 }}>
                            <Button type="primary" size="large" onClick={() => handleStartIndividualMatch(1)} loading={isStartingMatch} style={{ minWidth: '250px' }}>{team1Name}</Button>
                            <Button type="primary" size="large" onClick={() => handleStartIndividualMatch(2)} loading={isStartingMatch} style={{ minWidth: '250px' }}>{team2Name}</Button>
                        </Space>
                    </div>
                </Card>
            );
        }
        // UI for DUAL matches
        return (
            <Card>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')} style={{ marginBottom: 16 }}>Back to Matches</Button>
                <Title level={3} style={{ textAlign: 'center' }}>Start Dual Match</Title>
                <Form form={startForm} layout="vertical" onFinish={handleStartMatch} initialValues={{ initialServer: 1 }}>
                    <Form.Item name="initialServer" label="1. Select Serving Team" rules={[{ required: true }]}>
                        <Radio.Group><Radio value={1}>{team1Name}</Radio><Radio value={2}>{team2Name}</Radio></Radio.Group>
                    </Form.Item>
                    {selectedServingTeam && (
                        <>
                            <Form.Item name="initialServerPlayerId" label="2. Select First Server" rules={[{ required: true }]}>
                                <Select placeholder="Choose player to serve first">
                                    {selectedServingTeam === 1 ? (<><Option value={player1._id}>{player1.name}</Option><Option value={player2._id}>{player2.name}</Option></>)
                                        : (<><Option value={player3._id}>{player3.name}</Option><Option value={player4._id}>{player4.name}</Option></>)}
                                </Select>
                            </Form.Item>
                            <Form.Item name="initialReceiverPlayerId" label="3. Select First Receiver" rules={[{ required: true }]}>
                                <Select placeholder="Choose player to receive first">
                                    {selectedServingTeam === 1 ? (<><Option value={player3._id}>{player3.name}</Option><Option value={player4._id}>{player4.name}</Option></>)
                                        : (<><Option value={player1._id}>{player1.name}</Option><Option value={player2._id}>{player2.name}</Option></>)}
                                </Select>
                            </Form.Item>
                            <Form.Item><Button type="primary" htmlType="submit" loading={isStartingMatch} block>Start Match</Button></Form.Item>
                        </>
                    )}
                </Form>
            </Card>
        );
    }


    // --- UI for Live or Finished Match ---
    return (
        <>
            <Card>
                <Row justify="space-between" align="middle" style={{ marginBottom: 5, paddingBottom: 5, borderBottom: '1px solid #f0f0f0' }}>
                    <Col><Button style={{ color: '#aa14f0' }} icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')}> Back to Matches </Button></Col>
                    <Col><Title level={3} style={{ margin: 0 }}>Scoreboard - {category} ({matchType})</Title></Col>
                    <Col style={{ minWidth: 150, textAlign: 'right' }}>
                        <Button style={{ color: '#d81365' }} icon={<UndoOutlined />} onClick={handleUndo} disabled={!canUndo || isUpdatingScore || isUndoing} loading={isUndoing}> Undo Last Point </Button>
                    </Col>
                </Row>

                <Tag color="green" style={{ display: 'block', textAlign: 'center', margin: '8px auto 24px auto', fontSize: '1rem', maxWidth: '200px' }}>
                    {formatBestOf(setsToWin)} ({status})
                </Tag>

                {isFinished ? (
                    <Result
                        icon={<TrophyOutlined style={{ color: '#52c41a' }} />}
                        title={<Title level={2} style={{ color: '#52c41a' }}>Congratulations, {winnerName}!</Title>}
                        subTitle="You have won the match."
                        extra={<Space direction="vertical" align="center" size="large">{renderAvatars(winnerPlayers)}<Title level={4}>Final Set Score: {score?.currentSetScore?.team1 ?? 0} - {score?.currentSetScore?.team2 ?? 0}</Title></Space>}
                    />
                ) : null}

                {!isFinished && (
                    <Row justify="space-around" align="top" gutter={[16, 24]} style={{ marginBottom: 24, textAlign: 'center' }}>
                        <Col xs={24} sm={10}><Space direction="vertical" align="center" size="large">{renderAvatars(matchType === 'Dual' ? [player1, player2].filter(Boolean) : [player1].filter(Boolean), 'left')}<Title level={4}>{team1Name}</Title><Statistic title="Sets Won" value={score?.currentSetScore?.team1 ?? 0} /></Space></Col>
                        <Col xs={24} sm={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>vs</Col>
                        <Col xs={24} sm={10}><Space direction="vertical" align="center" size="large">{renderAvatars(matchType === 'Dual' ? [player3, player4].filter(Boolean) : [player2].filter(Boolean), 'right')}<Title level={4}>{team2Name}</Title><Statistic title="Sets Won" value={score?.currentSetScore?.team2 ?? 0} /></Space></Col>
                    </Row>
                )}

                {isLive && (
                    <>
                        <Divider>Current Game</Divider>
                        <Row justify="space-around" align="middle" gutter={16} style={{ marginBottom: 24, textAlign: 'center' }}>
                            <Col xs={24} md={10}><Statistic value={score?.currentGame?.team1 ?? 0} valueStyle={{ fontSize: '3.5rem' }} /><Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(1)} loading={isUpdatingScore || isUndoing} block>Point Player(s) 1</Button></Col>
                            <Col xs={0} md={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', color: '#aaa' }}>-</Col>
                            <Col xs={24} md={10}><Statistic value={score?.currentGame?.team2 ?? 0} valueStyle={{ fontSize: '3.5rem' }} /><Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(2)} loading={isUpdatingScore || isUndoing} block>Point Player(s) 2</Button></Col>
                        </Row>
                    </>
                )}

                {score?.sets && score.sets.length > 0 && (
                    <>
                        <Divider>Completed Sets</Divider>
                        <List size="small" bordered dataSource={score.sets} renderItem={(set, index) => (<List.Item><Text strong>Set {index + 1}:</Text><Text>{set[0]} - {set[1]}</Text></List.Item>)} style={{ maxWidth: 300, margin: '24px auto 0 auto' }} />
                    </>
                )}
            </Card>

            <Modal
                title={`Setup for Next Set (Set ${(score?.sets?.length || 0) + 1})`}
                open={isAwaitingNextSet}
                closable={false}
                footer={null}
            >
                {matchType === 'Dual' && (
                    <Form form={nextSetForm} layout="vertical" onFinish={handleNextSetSetup}>
                        <Form.Item name="initialServerTeam" label="1. Select Serving Team" rules={[{ required: true }]}>
                            <Radio.Group>
                                <Radio value={1}>{team1Name}</Radio>
                                <Radio value={2}>{team2Name}</Radio>
                            </Radio.Group>
                        </Form.Item>

                        {selectedNextServingTeam && (
                            <>
                                <Form.Item name="initialServerPlayerId" label="2. Select First Server" rules={[{ required: true }]}>
                                    <Select placeholder="Choose player to serve">
                                        {(selectedNextServingTeam === 1 ? [player1, player2] : [player3, player4]).filter(Boolean).map(p =>
                                            <Option key={p._id} value={p._id}>{p.name}</Option>
                                        )}
                                    </Select>
                                </Form.Item>
                                <Form.Item name="initialReceiverPlayerId" label="3. Select First Receiver" rules={[{ required: true }]}>
                                    <Select placeholder="Choose player to receive">
                                        {(selectedNextServingTeam === 1 ? [player3, player4] : [player1, player2]).filter(Boolean).map(p =>
                                            <Option key={p._id} value={p._id}>{p.name}</Option>
                                        )}
                                    </Select>
                                </Form.Item>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit" loading={isStartingMatch} block>
                                        Start Next Set
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form>
                )}

                {matchType === 'Individual' && (
                    <Form form={nextSetForm} layout="vertical" onFinish={handleNextSetSetup}>
                        <Form.Item name="initialServer" label="Who will serve first in this set?" rules={[{ required: true }]}>
                            <Radio.Group>
                                <Radio value={1}>{team1Name}</Radio>
                                <Radio value={2}>{team2Name}</Radio>
                            </Radio.Group>
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={isStartingMatch} block>
                                Start Next Set
                            </Button>
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </>
    );
};

export default Scoreboard;