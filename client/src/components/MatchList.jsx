// src/components/MatchList.jsx
import React, { useState, useEffect } from 'react';
import {
    List,
    Card,
    Button,
    Tag,
    Typography,
    Spin,
    Alert,
    Space,
    Select,
    message,
    Popconfirm,
    Avatar // Ensure Avatar is imported
} from 'antd';
import { DeleteOutlined, UserOutlined } from '@ant-design/icons'; // Ensure necessary icons are imported
import { useNavigate } from 'react-router-dom'; // Crucial for navigation
import axios from 'axios';

const { Option } = Select;
const { Title, Text } = Typography;
// Ensure VITE_API_URL is correctly set in your client/.env file
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper function to get displayable player/team names
// Assumes match object has player fields populated
const getTeamName = (match, teamNumber) => {
    if (!match || !match.player1) return 'Loading...';

    if (teamNumber === 1) {
        let name = match.player1.name;
        if (match.matchType === 'Dual' && match.player2) {
            name += ` / ${match.player2.name}`;
        }
        return name;
    } else { // teamNumber === 2
        let name = match.matchType === 'Individual' ? match.player2?.name : match.player3?.name;
        if (!name) return 'N/A';
        if (match.matchType === 'Dual' && match.player4) {
            name += ` / ${match.player4.name}`;
        }
        return name;
    }
};

// Helper to convert 'setsToWin' value (1, 2, 3) to 'Best of' value (1, 3, 5) for display
const setsToWinToBestOf = (sets) => {
    if (sets === 1) return 1;
    if (sets === 2) return 3;
    if (sets === 3) return 5;
    return 5; // Default fallback
};

// Helper to convert 'Best of' value (1, 3, 5) back to 'setsToWin' value (1, 2, 3) for API calls
const bestOfToSetsToWin = (bestOf) => {
    if (bestOf === 1) return 1;
    if (bestOf === 3) return 2;
    if (bestOf === 5) return 3;
    return 1; // Default fallback
};

// Helper function to render AVATAR for List Item Meta (typically Team 1)
// Assumes match object has player fields populated
const renderMetaAvatar = (match) => {
    if (!match) return <Avatar icon={<UserOutlined />} />; // Fallback if no match data

    const players = [];
    // Get Team 1 players (P1 for singles, P1 & P2 for doubles)
    if (match.player1) players.push(match.player1);
    if (match.matchType === 'Dual' && match.player2) players.push(match.player2);

    if (players.length === 0) return <Avatar icon={<UserOutlined />} />; // Fallback if no players found for team 1

    // Render single Avatar
    if (players.length === 1) {
        const player = players[0];
        const avatarSrc = player.photoUrl ? `${API_URL}${player.photoUrl}` : undefined; // Construct full URL
        return (
            <Avatar src={avatarSrc} icon={!avatarSrc ? <UserOutlined /> : null}>
                {/* Fallback initials if no photo */}
                {!avatarSrc ? player.name?.charAt(0)?.toUpperCase() : null}
            </Avatar>
        );
    } else { // Render Avatar Group for doubles
        return (
            <Avatar.Group maxCount={2}>
                {players.map(player => {
                    const avatarSrc = player.photoUrl ? `${API_URL}${player.photoUrl}` : undefined;
                    return (
                        <Avatar key={player._id} src={avatarSrc} icon={!avatarSrc ? <UserOutlined /> : null}>
                            {!avatarSrc ? player.name?.charAt(0)?.toUpperCase() : null}
                        </Avatar>
                    );
                })}
            </Avatar.Group>
        );
    }
};


const MatchList = ({ status = 'Upcoming', title = 'Upcoming Matches', onMatchStarted }) => {
    // State management
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true); // Loading state for the entire list fetch
    const [error, setError] = useState(null);     // Error state for fetching
    const [updatingLengthId, setUpdatingLengthId] = useState(null); // Track which match length is being updated
    const [deletingMatchId, setDeletingMatchId] = useState(null);  // Track which match is being deleted
    const navigate = useNavigate(); // React Router hook for navigation

    // Function to fetch matches from the backend based on status
    const fetchMatches = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_URL}/api/matches?status=${status}`);
            setMatches(response.data || []); // Ensure matches is always an array
        } catch (err) {
            console.error(`Error fetching ${status} matches:`, err);
            setError(`Failed to load ${status} matches.`);
            setMatches([]); // Reset matches on error
        } finally {
            setLoading(false); // Turn off loading indicator
        }
    };

    // Fetch matches when the component mounts or the 'status' prop changes
    useEffect(() => {
        fetchMatches();
    }, [status]);

    // Handler to navigate to the specific scoreboard page
    const handleStartMatch = (matchId) => {
        console.log('--- handleStartMatch Called ---'); // Debug log
        console.log('Match ID Received:', matchId);   // Debug log
        console.log('Type of ID:', typeof matchId);   // Debug log
        console.log('Target URL:', `/match/${matchId}/score`); // Debug log
        try {
            navigate(`/match/${matchId}/score`); // Perform navigation
            console.log('navigate() function executed.'); // Debug log
        } catch (err) {
            console.error('Error calling navigate:', err); // Debug log for navigation errors
        }
        if (onMatchStarted) {
            onMatchStarted(matchId); // Optional callback
        }
    };

    // Handler to update the match length (Best of X)
    const handleLengthChange = async (matchId, newBestOf) => {
        const newSetsToWin = bestOfToSetsToWin(newBestOf); // Convert for backend
        setUpdatingLengthId(matchId); // Set loading state for this item
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/length`, { setsToWin: newSetsToWin });
            // Update local state directly for immediate feedback
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
        setDeletingMatchId(matchId); // Set loading state for this item
        try {
            const response = await axios.delete(`${API_URL}/api/matches/${matchId}`);
            // Update local state directly by filtering out the deleted match
            setMatches(currentMatches => currentMatches.filter(m => m._id !== matchId));
            message.success(response.data?.message || 'Match deleted.');
        } catch (error) {
            console.error("Error deleting match:", error.response?.data || error.message);
            message.error(error.response?.data?.message || 'Failed to delete match.');
        } finally {
            setDeletingMatchId(null); // Clear loading state
        }
    };

    // --- Render loading/error states before attempting to render the list ---
    if (loading && matches.length === 0) { // Show spinner only on initial load
        return (
            <Card title={<Title level={4}>{title}</Title>}>
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin size="large" />
                </div>
            </Card>
        );
    }
    if (error && matches.length === 0) { // Show error only if initial load failed
        return (
            <Card title={<Title level={4}>{title}</Title>}>
                <Alert message="Error Loading Matches" description={error} type="error" showIcon />
            </Card>
        );
    }
    // --------------------------------------------------------------------

    // --- Render the List Card ---
    return (
        <Card title={<Title level={4} style={{ marginBottom: 0 }}>{title}</Title>}>
            <List
                itemLayout="horizontal"
                dataSource={matches}
                loading={loading} // Subtle loading indicator for subsequent fetches
                locale={{ emptyText: `No ${status} matches found.` }}
                renderItem={(match) => { // Render function for each item in the list
                    const currentBestOf = setsToWinToBestOf(match.setsToWin);
                    const isUpdating = updatingLengthId === match._id;
                    const isDeleting = deletingMatchId === match._id;

                    return (
                        <List.Item
                            key={match._id}
                            actions={ // Actions depend on the list's 'status' prop
                                status === 'Upcoming' ? [
                                    <Select // Length changer
                                        key="length-select"
                                        value={currentBestOf}
                                        style={{ width: 110, marginRight: 8 }}
                                        onChange={(value) => handleLengthChange(match._id, value)}
                                        loading={isUpdating}
                                        disabled={isUpdating || isDeleting}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Option value={1}>Best of 1</Option>
                                        <Option value={3}>Best of 3</Option>
                                        <Option value={5}>Best of 5</Option>
                                    </Select>,
                                    <Button // Start button
                                        key="start-button"
                                        type="primary"
                                        onClick={(e) => {
                                            console.log('Start button onClick triggered for match:', match._id); // Direct click log
                                            e.stopPropagation();
                                            handleStartMatch(match._id);
                                        }}
                                        disabled={isUpdating || isDeleting}
                                    >
                                        Start & Score
                                    </Button>,
                                    <Popconfirm // Delete confirmation
                                        key="delete-popconfirm"
                                        title="Delete this match?"
                                        description="Are you sure? This cannot be undone."
                                        onConfirm={(e) => { e?.stopPropagation(); handleDeleteMatch(match._id); }}
                                        onCancel={(e) => e?.stopPropagation()}
                                        okText="Yes, Delete"
                                        cancelText="No"
                                        okButtonProps={{ loading: isDeleting, danger: true }}
                                        disabled={isUpdating || isDeleting}
                                    >
                                        <Button // Delete trigger button
                                            key="delete-button"
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            loading={isDeleting}
                                            disabled={isUpdating}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </Popconfirm>
                                ] : status === 'Live' ? [
                                    <Button // View button for live matches
                                        key="view-button"
                                        type="default"
                                        onClick={(e) => { e.stopPropagation(); handleStartMatch(match._id); }}
                                    >
                                        View Scoreboard
                                    </Button>
                                ] : null // No default actions for 'Finished' or other statuses
                            }
                        >
                            {/* Display item metadata (Avatar, Title, Description) */}
                            <List.Item.Meta
                                avatar={renderMetaAvatar(match)} // Render Team 1 avatar/group
                                title={
                                    <Space wrap>
                                        <Text strong>{getTeamName(match, 1)}</Text>
                                        <Text>vs</Text>
                                        <Text strong>{getTeamName(match, 2)}</Text>
                                    </Space>
                                }
                                description={
                                    <Space wrap size="small" style={{ marginTop: '4px' }}>
                                        <Tag>{match.category}</Tag>
                                        <Tag>{match.matchType}</Tag>
                                        <Tag color={isUpdating ? 'processing' : isDeleting ? 'error' : 'default'}>
                                            {isUpdating ? 'Updating...' : isDeleting ? 'Deleting...' : `Best of ${currentBestOf}`}
                                        </Tag>
                                    </Space>
                                }
                            />
                        </List.Item>
                    );
                }}
            />
        </Card>
    );
};

export default MatchList;