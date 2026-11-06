USE gym_management;

-- Store a fictional emergency contact phone number in encrypted form.
UPDATE members
SET emergency_contact_phone_encrypted = AES_ENCRYPT(
    '0917-555-0199',
    'REPLACE_WITH_LOCAL_DEMO_KEY'
)
WHERE member_id = 18;

-- Retrieve the encrypted value in readable form for the classroom demonstration.
SELECT
    member_id,
    member_code,
    AES_DECRYPT(
        emergency_contact_phone_encrypted,
        'REPLACE_WITH_LOCAL_DEMO_KEY'
    ) AS emergency_contact_phone
FROM members
WHERE member_id = 18;
