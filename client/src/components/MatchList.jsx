// src/components/MatchList.jsx
import React, { useState, useEffect } from 'react';
import { List, Card, Button, Tag, Typography, Spin, Alert, Space, Select, message, Popconfirm, Avatar, Row, Col } from 'antd';
import { DeleteOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Option } = Select;
const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';


const formatMatchLength = (match) => {
    if (!match) return '';
    if (match.matchType === 'Team') {
        if (match.teamMatchSubType === 'Relay') { return `Relay to ${match.setPointTarget * match.numberOfSets}`; }
        return `${match.numberOfSets || 'N/A'} Sets`;
    }
    // Individual/Dual
    const bestOfMap = { 1: 'Best of 1', 2: 'Best of 3', 3: 'Best of 5' };
    return bestOfMap[match.setsToWin] || 'Best of 1';
};



const MatchList = ({ status = 'Upcoming', title = 'Matches', matchTypeFilter = null }) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchMatches = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = { status };
                if (matchTypeFilter) { params.matchTypeFilter = matchTypeFilter; }
                const response = await axios.get(`${API_URL}/api/matches`, { params });
                setMatches(response.data || []);
            } catch (err) {
                setError(`Failed to load ${status} matches.`);
            } finally {
                setLoading(false);
            }
        };
        fetchMatches();
    }, [status, matchTypeFilter]);

    const handleNavigateToScoreboard = (match) => {
        if (!match || !match._id) return;
        if (match.matchType === 'Team') {
            navigate(`/team-match/${match._id}/score`);
        } else {
            navigate(`/match/${match._id}/score`);
        }
    };

    // Handler to navigate to the specific scoreboard page
    const handleStartMatch = (matchId) => {
        console.log('--- handleStartMatch Called ---');
        console.log('Match ID Received:', matchId);
        console.log('Type of ID:', typeof matchId);
        console.log('Target URL:', `/match/${matchId}/score`);
        try {
            navigate(`/match/${matchId}/score`);
            console.log('navigate() function executed.');
        } catch (err) {
            console.error('Error calling navigate:', err); 
        }
        if (onMatchStarted) {
            onMatchStarted(matchId);
        }
    };

    // Handler to update the match length (Best of X)
    const handleLengthChange = async (matchId, newBestOf) => {
        const newSetsToWin = bestOfToSetsToWin(newBestOf);
        setUpdatingLengthId(matchId);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/length`, { setsToWin: newSetsToWin });
            setMatches(currentMatches =>
                currentMatches.map(m => (m._id === matchId ? response.data : m))
            );
            message.success('Match length updated!');
        } catch (error) {
            console.error("Error updating match length:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to update length.');
        } finally {
            setUpdatingLengthId(null); // Clear loading state
        }
    };

    // Handler to delete an upcoming match
    const handleDeleteMatch = async (matchId) => {
        setDeletingMatchId(matchId);
        try {
            const response = await axios.delete(`${API_URL}/api/matches/${matchId}`);
            setMatches(currentMatches => currentMatches.filter(m => m._id !== matchId));
            message.success(response.data?.message || 'Match deleted.');
        } catch (error) {
            console.error("Error deleting match:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to delete match.');
        } finally {
            setDeletingMatchId(null); // Clear loading state
        }
    };

    if (loading && matches.length === 0) {
        return <Card title={title}><div style={{ textAlign: 'center', padding: 50 }}><Spin /></div></Card>;
    }
    if (error && matches.length === 0) {
        return <Card title={title}><Alert message="Error" description={error} type="error" showIcon /></Card>;
    }

    const renderAvatarDisplay = (players = []) => {
        if (!players || players.length === 0) {
            return <Avatar size="large" icon={<UserOutlined />} />;
        }
        if (players.length === 1) {
            const p = players[0];
            return <Avatar size="large" src={p?.photoUrl ? `${API_URL}${p.photoUrl}` : undefined}>{!p?.photoUrl && p?.name ? p.name.charAt(0).toUpperCase() : <UserOutlined />}</Avatar>;
        }
        return (
            <Avatar.Group max={{ count: 2 }}>
                {players.map(p => (
                    p ? <Avatar key={p._id} src={p.photoUrl ? `${API_URL}${p.photoUrl}` : undefined}>{!p.photoUrl && p.name ? p.name.charAt(0).toUpperCase() : <UserOutlined />}</Avatar> : null
                ))}
            </Avatar.Group>
        );
    };

    // --- Render the List Card ---
    return (
        <Card title={<Title level={4}>{title}</Title>}>
            <List
                itemLayout="horizontal"
                dataSource={matches}
                loading={loading}
                locale={{ emptyText: `No ${status} matches found.` }}
                pagination={{ pageSize: 5, hideOnSinglePage: true }}
                renderItem={(match) => {
                    const isUpdating = updatingId === match._id;

                    // --- REWRITTEN AND SIMPLIFIED DISPLAY LOGIC ---
                    let team1Name, team2Name, team1Avatars, team2Avatars, descriptionTags;

                    if (match.matchType === 'Team') {
                        team1Name = match.team1?.name || 'N/A';
                        team2Name = match.team2?.name || 'N/A';
                        team1Avatars = <Avatar size="large" src={match.team1?.logoUrl ? `${API_URL}${match.team1.logoUrl}` : undefined} icon={<UserOutlined />} />;
                        team2Avatars = <Avatar size="large" src={match.team2?.logoUrl ? `${API_URL}${match.team2.logoUrl}` : undefined} icon={<UserOutlined />} />;
                        descriptionTags = <><Tag color="purple">{match.matchType} ({match.teamMatchSubType})</Tag><Tag>{formatMatchLength(match)}</Tag></>;
                    } else { // Individual or Dual
                        const team1Players = [match.player1, match.matchType === 'Dual' ? match.player2 : null].filter(Boolean);
                        const team2Players = [match.matchType === 'Individual' ? match.player2 : match.player3, match.matchType === 'Dual' ? match.player4 : null].filter(Boolean);

                        team1Name = team1Players.map(p => p.name).join(' & ') || 'N/A';
                        team2Name = team2Players.map(p => p.name).join(' & ') || 'N/A';

                        team1Avatars = renderAvatarDisplay(team1Players);
                        team2Avatars = renderAvatarDisplay(team2Players);
                        descriptionTags = <>{match.category && <Tag>{match.category}</Tag>}<Tag color="purple">{match.matchType}</Tag><Tag>{formatMatchLength(match)}</Tag></>;
                    }

                    // Override display for Finished matches
                    if (status === 'Finished') {
                        let winnerName = 'N/A'; let finalScore = '';
                        // ... (Your correct logic for winnerName and finalScore based on matchType) ...
                        descriptionTags = <> <Tag icon={<CrownOutlined />} color="gold">Winner: {winnerName || 'N/A'}</Tag> <Tag>Final Score: {finalScore}</Tag> </>;
                    }
                    // ------------------------------------

                    return (
                        <List.Item
                            key={match._id}
                            actions={
                                status === 'Upcoming' ? [
                                    (match.matchType !== 'Team' && <Select key="length" value={match.setsToWin} style={{ width: 120 }} onChange={(val) => handleLengthChange(match._id, val)} disabled={isUpdating}><Option value={1}>Best of 1</Option><Option value={2}>Best of 3</Option><Option value={3}>Best of 5</Option></Select>),
                                    <Button key="start" type="primary" onClick={() => handleNavigateToScoreboard(match)} disabled={isUpdating}>Start & Score</Button>,
                                    <Popconfirm key="delete" title="Delete?" onConfirm={() => handleDeleteMatch(match._id)} okButtonProps={{ loading: isUpdating }}><Button danger type="text" icon={<DeleteOutlined />} disabled={isUpdating} /></Popconfirm>
                                ] : status === 'Live' ? [<Button key="view" onClick={() => handleNavigateToScoreboard(match)}>View Scoreboard</Button>]
                                : null
                            }
                        >
                            {/* Use a Row for the new layout */}
                            <Row align="middle" style={{ width: '100%' }}>
                                <Col flex="auto">
                                    <Row align="middle" gutter={16}>
                                        <Col><Text strong>{team1Name}</Text></Col>
                                        <Col>{team1Avatars}</Col>
                                        <Col><Text>vs</Text></Col>
                                        <Col>{team2Avatars}</Col>
                                        <Col><Text strong>{team2Name}</Text></Col>
                                    </Row>
                                    <Row style={{ marginTop: '8px' }}>
                                        <Col><Space>{descriptionTags}</Space></Col>
                                    </Row>
                                </Col>
                            </Row>
                        </List.Item>
                    );
                }}
            />
        </Card>
    );
};

export default MatchList;