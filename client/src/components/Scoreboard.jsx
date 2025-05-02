// src/components/Scoreboard.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Typography, Spin, Alert, Card, Row, Col, Button, Statistic,
    Divider, List, Tag, message, Avatar, Space, Tooltip
} from 'antd';
import { PlusOutlined, ArrowLeftOutlined, UserOutlined, UndoOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper function to get displayable player/team names
const getTeamName = (match, teamNumber) => {
    if (!match || !match.player1) return 'Loading...';
    if (teamNumber === 1) {
        let name = match.player1.name;
        if (match.matchType === 'Dual' && match.player2) { name += ` / ${match.player2.name}`; }
        return name;
    } else {
        let name = match.matchType === 'Individual' ? match.player2?.name : match.player3?.name;
        if (!name) return 'N/A';
        if (match.matchType === 'Dual' && match.player4) { name += ` / ${match.player4.name}`; }
        return name;
    }
};

// Helper function to convert setsToWin to Best Of for display
const setsToWinToBestOf = (sets) => {
    if (sets === 1) return 1;
    if (sets === 2) return 3;
    if (sets === 3) return 5;
    return 5; // Default
};

// Helper function to render player avatars including serving indicator
const renderTeamAvatars = (match, teamNumber, isServing) => {
    if (!match) return null;
    const players = [];
    if (teamNumber === 1) {
        if (match.player1) players.push(match.player1);
        if (match.matchType === 'Dual' && match.player2) players.push(match.player2);
    } else {
        if (match.matchType === 'Individual' && match.player2) players.push(match.player2);
        if (match.matchType === 'Dual' && match.player3) players.push(match.player3);
        if (match.matchType === 'Dual' && match.player4) players.push(match.player4);
    }
    const avatarSize = 80;

    const avatarContent = (player) => {
        const avatarSrc = player?.photoUrl ? `${API_URL}${player.photoUrl}` : undefined;
        return (
            <Avatar key={player?._id || `avatar-${Math.random()}`} size={avatarSize} src={avatarSrc} icon={!avatarSrc ? <UserOutlined /> : null}>
                {!avatarSrc ? player?.name?.charAt(0)?.toUpperCase() : null}
            </Avatar>
        );
    };

    let avatarComponent;
    if (players.length === 0) { avatarComponent = <Avatar size={avatarSize} icon={<UserOutlined />} />; }
    else if (players.length === 1) { avatarComponent = avatarContent(players[0]); }
    else { avatarComponent = <Avatar.Group max={{ count: 2 }} size={avatarSize}>{players.map(avatarContent)}</Avatar.Group>; }

    if (isServing) { // Add indicator if serving
        return (
            <Tooltip title="Serving">
                <span style={{ border: '3px solid #1677ff', borderRadius: '50%', display: 'inline-block', padding: '3px', lineHeight: 0 }}>
                    {avatarComponent}
                </span>
            </Tooltip>
        );
    }
    return avatarComponent; // Return plain if not serving
};


const Scoreboard = () => {
    const { id: matchId } = useParams();
    const navigate = useNavigate();
    const [matchData, setMatchData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdatingScore, setIsUpdatingScore] = useState(false);
    const [isUndoing, setIsUndoing] = useState(false);
    const [isStartingMatch, setIsStartingMatch] = useState(false); // State for start action

    // Fetch match data
    useEffect(() => {
        if (!matchId) return;
        let isMounted = true;
        const fetchMatch = async () => {
            setLoading(true);
            setError(null); // Clear previous errors on new fetch
            try {
                const response = await axios.get(`${API_URL}/api/matches/${matchId}`);
                if (isMounted) { setMatchData(response.data); }
            } catch (err) {
                console.error("Error fetching match data:", err);
                if (isMounted) { setError("Failed to load match data."); }
            } finally {
                if (isMounted) { setLoading(false); }
            }
        };
        fetchMatch();
        return () => { isMounted = false; }; // Cleanup
    }, [matchId]);

    // Handler for Score Update Button Click
    const handleScoreUpdate = async (scoringTeam) => {
        if (isUpdatingScore || matchData?.status !== 'Live' || isUndoing) return;
        setIsUpdatingScore(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/score`, { scoringTeam });
            setMatchData(response.data); // Update local state
            if (response.data.status === 'Finished') { // Check if match finished
                let finalWinnerName = 'N/A';
                const winnerIdentifier = response.data.winner;
                if (response.data.matchType === 'Individual') { finalWinnerName = winnerIdentifier === response.data.player1?._id ? getTeamName(response.data, 1) : getTeamName(response.data, 2); }
                else { finalWinnerName = winnerIdentifier === 1 ? getTeamName(response.data, 1) : getTeamName(response.data, 2); }
                message.success(`Match finished! Winner: ${finalWinnerName}`);
            }
        } catch (error) {
            console.error("Error updating score:", error.response?.data || error.message);
            message.error(error.response?.data?.message || "Failed to update score.");
        } finally {
            setIsUpdatingScore(false);
        }
    };

    // Handler for Undo Button Click
    const handleUndo = async () => {
        if (isUndoing || isUpdatingScore || matchData?.status !== 'Live' || !matchData?.pointHistory?.length) {
            message.warning("Cannot undo point right now.");
            return;
        }
        setIsUndoing(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/undo`);
            setMatchData(response.data); // Update state with reverted data
            message.success('Last point undone.');
        } catch (error) {
            console.error("Error undoing point:", error.response?.data || error.message);
            message.error(error.response?.data?.message || "Failed to undo point.");
        } finally {
            setIsUndoing(false);
        }
    };

    // Handler to Start Match and Set Server
    const handleStartMatchWithServer = async (serverChoice) => {
        if (isStartingMatch || matchData?.status !== 'Upcoming') return;
        setIsStartingMatch(true);
        setError(null); // Clear previous errors
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/start`, { initialServer: serverChoice });
            setMatchData(response.data); // Update state with the now 'Live' match data
            message.success(`Match started! Team ${serverChoice} serving.`);
        } catch (error) {
            console.error("Error starting match:", error.response?.data || error.message);
            const errorMsg = error.response?.data?.message || "Failed to start match.";
            setError(errorMsg); // Set error state to display in Alert
            message.error(errorMsg);
        } finally {
            setIsStartingMatch(false);
        }
    };

    // --- Loading State ---
    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" tip="Loading Scoreboard..." /></div>;
    }

    // --- Error State ---
    if (error) {
        return (
            <div style={{ padding: 20 }}>
                <Alert message="Error" description={error} type="error" showIcon />
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')} style={{ marginTop: 16 }}>
                    Back to Matches
                </Button>
            </div>
        );
    }

    // --- Match Not Found / Data Missing State ---
    if (!matchData && !loading) {
        return (
            <div style={{ padding: 20 }}>
                <Alert message="Match data not found." type="warning" showIcon />
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')} style={{ marginTop: 16 }}>
                    Back to Matches
                </Button>
            </div>
        );
    }

    // --- Prepare display variables after data is loaded ---
    const team1Name = getTeamName(matchData, 1);
    const team2Name = getTeamName(matchData, 2);
    const bestOf = setsToWinToBestOf(matchData?.setsToWin);
    const status = matchData?.status;
    const isFinished = status === 'Finished';
    const isLive = status === 'Live';
    const isUpcoming = status === 'Upcoming';
    const currentServer = matchData?.score?.server;
    const canUndo = isLive && matchData?.pointHistory?.length > 0;
    let winnerDisplayName = 'N/A';
    if (isFinished && matchData.winner) {
        if (matchData.matchType === 'Individual') { winnerDisplayName = matchData.winner === matchData.player1?._id ? team1Name : team2Name; }
        else { winnerDisplayName = matchData.winner === 1 ? team1Name : team2Name; }
    }
    // -------------------------------------------------------

    // === Conditional Rendering: Choose Server vs Scoreboard ===

    // --- Render Choose Server UI if Match is Upcoming ---
    if (isUpcoming) {
        return (
            <Card>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')} style={{ marginBottom: 16 }}>
                    Back to Matches
                </Button>
                <Title level={3} style={{ textAlign: 'center' }}>Start Match</Title>
                <div style={{ textAlign: 'center', margin: '30px 0' }}>
                    <Title level={5}>Who serves first?</Title>
                    <Space direction="vertical" size="large" style={{ marginTop: 20 }}>
                        <Button
                            type="primary" size="large"
                            onClick={() => handleStartMatchWithServer(1)}
                            loading={isStartingMatch} style={{ minWidth: '200px' }}
                        >
                            {team1Name || 'Team 1'}
                        </Button>
                        <Button
                            type="primary" size="large"
                            onClick={() => handleStartMatchWithServer(2)}
                            loading={isStartingMatch} style={{ minWidth: '200px' }}
                        >
                            {team2Name || 'Team 2'}
                        </Button>
                    </Space>
                </div>
            </Card>
        );
    }

    // --- Render Main Scoreboard UI if Live or Finished ---
    return (
        <Card bordered={false}>
            {/* Row for Back and Undo Buttons */}
            <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
                <Col>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup-match')}> Back to Matches </Button>
                </Col>
                <Col>
                    <Button icon={<UndoOutlined />} onClick={handleUndo} disabled={!canUndo || isUpdatingScore || isUndoing} loading={isUndoing}> Undo Last Point </Button>
                </Col>
            </Row>

            {/* Header Info */}
            <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}> Scoreboard - {matchData.category} ({matchData.matchType}) </Title>
            <Tag color="blue" style={{ display: 'block', textAlign: 'center', marginBottom: 24, fontSize: '1rem' }}> Best of {bestOf} Sets ({status}) </Tag>

            {/* Winner Alert */}
            {isFinished && (<Alert message={<Title level={4} style={{ margin: 0 }}>Match Finished!</Title>} description={<h1 strong> Winner: {winnerDisplayName} </h1>} type="success" showIcon style={{ marginBottom: 24 }} />)}

            {/* Row for Team Info */}
            <Row justify="space-around" align="top" gutter={[16, 24]} style={{ marginBottom: 24, textAlign: 'center' }}>
                {/* Team 1 Column */}
                <Col xs={24} sm={10}> <Space direction="vertical" align="center" size="large"> {renderTeamAvatars(matchData, 1, currentServer === 1 && isLive)} <Title level={4} style={{ marginBottom: 0, marginTop: 0 }}>{team1Name}</Title> <Statistic title="Sets Won" value={matchData.score?.currentSetScore?.team1 ?? 0} /> </Space> </Col>
                {/* VS Separator */}
                <Col xs={24} sm={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', minHeight: '150px' }}> vs </Col>
                {/* Team 2 Column */}
                <Col xs={24} sm={10}> <Space direction="vertical" align="center" size="large"> {renderTeamAvatars(matchData, 2, currentServer === 2 && isLive)} <Title level={4} style={{ marginBottom: 0, marginTop: 0 }}>{team2Name}</Title> <Statistic title="Sets Won" value={matchData.score?.currentSetScore?.team2 ?? 0} /> </Space> </Col>
            </Row>

            <Divider>Current Game</Divider>

            {/* Row for Current Game Score & Buttons */}
            <Row justify="space-around" align="middle" gutter={[16, 16]} style={{ marginBottom: 24, textAlign: 'center' }}>
                {/* Team 1 */}
                <Col xs={24} md={10}> <Statistic value={matchData.score?.currentGame?.team1 ?? 0} valueStyle={{ fontSize: '3.5rem' }} /> {isLive && (<Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(1)} loading={isUpdatingScore || isUndoing} disabled={isUndoing} style={{ marginTop: 8 }} block> Point Team 1 </Button>)} </Col>
                {/* Separator */}
                <Col xs={0} md={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', color: '#aaa' }}> - </Col>
                {/* Team 2 */}
                <Col xs={24} md={10}> <Statistic value={matchData.score?.currentGame?.team2 ?? 0} valueStyle={{ fontSize: '3.5rem' }} /> {isLive && (<Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(2)} loading={isUpdatingScore || isUndoing} disabled={isUndoing} style={{ marginTop: 8 }} block> Point Team 2 </Button>)} </Col>
            </Row>

            {/* Display Completed Set Scores */}
            {matchData.score?.sets && matchData.score.sets.length > 0 && (
                <>
                    <Divider>Completed Sets</Divider>
                    <List size="small" bordered dataSource={matchData.score.sets} renderItem={(setScore, index) => (<List.Item> <Text strong style={{ marginRight: 'auto' }}>Set {index + 1}:</Text> <Text>{setScore[0]} - {setScore[1]}</Text> </List.Item>)} style={{ maxWidth: 300, margin: '24px auto 0 auto' }} />
                </>
            )}
        </Card>
    );
};

export default Scoreboard;