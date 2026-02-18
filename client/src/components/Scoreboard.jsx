// src/components/Scoreboard.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Typography, Spin, Alert, Card, Row, Col, Button, Statistic,
    Divider, List, Tag, message, Avatar, Space, Tooltip, Result
} from 'antd';
import { PlusOutlined, ArrowLeftOutlined, UserOutlined, UndoOutlined, TrophyOutlined } from '@ant-design/icons';
import axios from 'axios';

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

    // --- Data Fetching ---
    useEffect(() => {
        if (!matchId) return;
        let isMounted = true;
        const fetchMatch = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`${API_URL}/api/matches/${matchId}`);
                if (isMounted) { setMatchData(response.data); }
            } catch (err) {
                if (isMounted) { setError("Failed to load match data."); }
            } finally {
                if (isMounted) { setLoading(false); }
            }
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

    const handleStartMatchWithServer = async (serverChoice) => {
        if (isStartingMatch || matchData?.status !== 'Upcoming') return;
        setIsStartingMatch(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/start`, { initialServer: serverChoice });
            setMatchData(response.data);
            message.success(`Match started!`);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to start match.");
        } finally {
            setIsStartingMatch(false);
        }
    };

    // --- Loading and Error States ---
    if (loading) { return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>; }
    if (error) { return <div style={{ padding: 20 }}><Alert message="Error" description={error} type="error" showIcon /></div>; }
    if (!matchData) { return <div style={{ padding: 20 }}><Alert message="Match data not found." type="warning" showIcon /></div>; }

    // --- Prepare ALL display variables here for clarity ---
    const { status, matchType, category, player1, player2, player3, player4, score, setsToWin, winner } = matchData;
    const isFinished = status === 'Finished';
    const isUpcoming = status === 'Upcoming';
    const isLive = status === 'Live';
    const currentServer = score?.server;
    const canUndo = isLive && matchData.pointHistory?.length > 0;

    const team1Name = matchType === 'Dual' ? `${player1?.name || 'P1'} & ${player2?.name || 'P2'}` : player1?.name;
    const team2Name = matchType === 'Dual' ? `${player3?.name || 'P3'} & ${player4?.name || 'P4'}` : player2?.name;

    // --- THE WINNER LOGIC ---
    let winnerName = 'N/A';
    if (isFinished && winner) {
        console.log("--- DEBUGGING WINNER ---");
        console.log("Match Type:", matchType);
        console.log("Winner from DB (winner):", winner);
        console.log("Player 1 Object:", player1);
        console.log("Player 2 Object:", player2);
        console.log("Is winner === player1._id?", winner?.toString() === player1?._id?.toString());
        console.log("Is winner === player2._id?", winner?.toString() === player2?._id?.toString());

        if (matchType === 'Individual') {
            if (winner.toString() === player1?._id.toString()) {
                winnerName = player1.name;
            } else if (winner.toString() === player2?._id.toString()) {
                winnerName = player2.name;
            }
        } else if (matchType === 'Dual') {
            winnerName = winner === 1 ? team1Name : team2Name;
        }
        console.log("Final determined winnerName:", winnerName);
        console.log("------------------------");
    }

    // --- Avatar Rendering Helper Function ---
    const renderAvatars = (players, isServing) => {
        const avatarSize = 100;
        const avatarContent = (p) => (
            <Avatar size={avatarSize} src={p.photoUrl ? `${API_URL}${p.photoUrl}` : undefined}>
                {!p.photoUrl ? p.name?.charAt(0) : null}
            </Avatar>
        );

        let avatarComponent;
        if (!players || players.length === 0) {
            avatarComponent = <Avatar size={avatarSize} icon={<UserOutlined />} />;
        } else if (players.length === 1) {
            avatarComponent = avatarContent(players[0]);
        } else {
            avatarComponent = <Avatar.Group max={{ count: 2 }}>{players.map(p => <Avatar key={p._id} {...avatarContent(p).props} />)}</Avatar.Group>;
        }

        if (isServing && isLive) {
            return (
                <Tooltip title="Serving">
                    <span style={{ border: '3px solid #1677ff', borderRadius: '50%', display: 'inline-block', padding: '3px', lineHeight: 0 }}>
                        {avatarComponent}
                    </span>
                </Tooltip>
            );
        }
        return avatarComponent;
    };

    // --- UI for Selecting First Server ---
    if (isUpcoming) {
        return (
            <Card>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')} style={{ marginBottom: 16 }}>Back to Matches</Button>
                <Title level={3} style={{ textAlign: 'center' }}>Start Match</Title>
                <div style={{ textAlign: 'center', margin: '30px 0' }}>
                    <Title level={5}>Who serves first?</Title>
                    <Space direction="vertical" size="large" style={{ marginTop: 20 }}>
                        <Button type="primary" size="large" onClick={() => handleStartMatchWithServer(1)} loading={isStartingMatch} style={{ minWidth: '250px' }}>{team1Name || 'Team 1'}</Button>
                        <Button type="primary" size="large" onClick={() => handleStartMatchWithServer(2)} loading={isStartingMatch} style={{ minWidth: '250px' }}>{team2Name || 'Team 2'}</Button>
                    </Space>
                </div>
            </Card>
        );
    }

    // --- UI for Live or Finished Match ---
    return (
        <Card variant={false} style={{ padding: '16px' }}>
            <Row justify="space-between" align="middle" style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #f0f0f0' }}>
                <Col><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')}> Back to Matches </Button></Col>
                <Col><Title level={3} style={{ margin: 0 }}>Scoreboard - {category} ({matchType})</Title></Col>
                <Col style={{ minWidth: 150, textAlign: 'right' }}>
                    {isLive && (<Button icon={<UndoOutlined />} onClick={handleUndo} disabled={!canUndo || isUpdatingScore || isUndoing} loading={isUndoing}> Undo Last Point </Button>)}
                </Col>
            </Row>

            <Tag color="blue" style={{ display: 'block', textAlign: 'center', margin: '8px auto 24px auto', fontSize: '1rem', maxWidth: '200px' }}>
                {formatBestOf(setsToWin)} ({status})
            </Tag>

            {isFinished ? (
            <Result
                icon={<TrophyOutlined style={{ color: '#52c41a' }} />}
                title={<Title level={2} style={{ color: '#52c41a' }}>Congratulations, {winnerName}!</Title>}
                subTitle="You have won the match."
                extra={
                    <Space direction="vertical" align="center" size="large">
                        {renderAvatars(
                            matchType === 'Individual'
                                ? [winner.toString() === player1?._id.toString() ? player1 : player2]
                                : (winner === 1 ? [player1, player2] : [player3, player4]),
                            false
                        )}
                        <Title level={4} style={{ marginTop: 8 }}>Final Set Score: {score?.currentSetScore?.team1 ?? 0} - {score?.currentSetScore?.team2 ?? 0}</Title>
                    </Space>
                }
            />
        ) : null}

            {!isFinished && (
                <Row justify="space-around" align="top" gutter={[16, 24]} style={{ marginBottom: 24, textAlign: 'center' }}>
                    <Col xs={24} sm={10}>
                        <Space direction="vertical" align="center" size="large">
                            {renderAvatars(matchType === 'Dual' ? [player1, player2].filter(Boolean) : [player1].filter(Boolean), currentServer === 1)}
                            <Title level={4} style={{ marginTop: 8 }}>{team1Name}</Title>
                            <Statistic title="Sets Won" value={score?.currentSetScore?.team1 ?? 0} />
                        </Space>
                    </Col>
                    <Col xs={24} sm={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>vs</Col>
                    <Col xs={24} sm={10}>
                        <Space direction="vertical" align="center" size="large">
                            {renderAvatars(matchType === 'Dual' ? [player3, player4].filter(Boolean) : [player2].filter(Boolean), currentServer === 2)}
                            <Title level={4} style={{ marginTop: 8 }}>{team2Name}</Title>
                            <Statistic title="Sets Won" value={score?.currentSetScore?.team2 ?? 0} />
                        </Space>
                    </Col>
                </Row>
            )}

            {isLive && (
                <>
                    <Divider>Current Game</Divider>
                    <Row justify="space-around" align="middle" gutter={16} style={{ marginBottom: 24, textAlign: 'center' }}>
                        <Col xs={24} md={10}>
                            <Statistic value={score?.currentGame?.team1 ?? 0} valueStyle={{ fontSize: '3.5rem' }} />
                            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(1)} loading={isUpdatingScore || isUndoing} block>Point Player(s) 1</Button>
                        </Col>
                        <Col xs={0} md={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', color: '#aaa' }}>-</Col>
                        <Col xs={24} md={10}>
                            <Statistic value={score?.currentGame?.team2 ?? 0} valueStyle={{ fontSize: '3.5rem' }} />
                            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(2)} loading={isUpdatingScore || isUndoing} block>Point Player(s) 2</Button>
                        </Col>
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
    );
};

export default Scoreboard;